#' Nexus-Bio R SDK Client
#'
#' An R6 class providing programmatic access to the Nexus-Bio
#' synthetic biology AI platform REST API.
#'
#' @examples
#' \dontrun{
#' client <- NexusBioClient$new(api_key = "your-key")
#' health <- client$health()
#' cat(health$status)
#'
#' result <- client$analyze("Design an artemisinin pathway")
#' }
#'
#' @export
NexusBioClient <- R6::R6Class(
  "NexusBioClient",
  public = list(

    #' @field api_key API key for authentication.
    api_key = NULL,

    #' @field base_url Base URL of the Nexus-Bio instance.
    base_url = NULL,

    #' @field timeout Request timeout in seconds.
    timeout = NULL,

    #' @description
    #' Create a new NexusBioClient.
    #'
    #' @param api_key API key for authentication (sent as X-API-Key header).
    #' @param base_url Base URL of the Nexus-Bio instance.
    #' @param timeout Request timeout in seconds.
    initialize = function(api_key,
                          base_url = "https://nexus-bio-1-0.vercel.app",
                          timeout = 30) {
      stopifnot(is.character(api_key), nchar(api_key) > 0)
      self$api_key <- api_key
      self$base_url <- sub("/+$", "", base_url)
      self$timeout <- timeout
    },

    #' @description
    #' Send a research query to the AI assistant.
    #'
    #' @param prompt Research question or instruction.
    #' @param context Optional named list of context data.
    #' @param history Optional conversation history (list of turn objects).
    #' @param search_query Optional dynamic search query override.
    #'
    #' @return A list with `candidates` and `meta` fields.
    analyze = function(prompt, context = NULL, history = NULL, search_query = NULL) {
      body <- list(prompt = prompt)
      if (!is.null(context)) body$context <- context
      if (!is.null(history)) body$history <- history
      if (!is.null(search_query)) body$searchQuery <- search_query
      private$post("/api/analyze", body)
    },

    #' @description
    #' List all workbench projects.
    #'
    #' @return A list of project summaries.
    list_projects = function() {
      result <- private$get("/api/workbench")
      if (is.data.frame(result) || is.list(result)) {
        return(result)
      }
      list(result)
    },

    #' @description
    #' Run a Flux Balance Analysis simulation.
    #'
    #' @param objective Optimization objective: 'biomass', 'product', or 'atp'.
    #' @param species Target organism: 'ecoli' or 'yeast'.
    #' @param mode Analysis mode: 'single' or 'community'.
    #' @param action Analysis action: 'fba', 'fva', 'pfba', 'knockout', 'fseof', or 'optknock'.
    #' @param glucose_uptake Glucose uptake rate (mmol/gDW/h).
    #' @param oxygen_uptake Oxygen uptake rate (mmol/gDW/h).
    #' @param knockouts Character vector of reaction IDs to knock out.
    #' @param alpha Community balance parameter (0-1).
    #' @param model Optional custom FBA model definition (named list).
    #'
    #' @return A list with `ok`, `growthRate`, `fluxes`, etc.
    run_fba = function(objective = "biomass",
                       species = "ecoli",
                       mode = "single",
                       action = "fba",
                       glucose_uptake = 10,
                       oxygen_uptake = 12,
                       knockouts = character(0),
                       alpha = 0.5,
                       model = NULL) {
      body <- list(
        mode = mode,
        species = species,
        objective = objective,
        action = action,
        glucoseUptake = glucose_uptake,
        oxygenUptake = oxygen_uptake,
        knockouts = as.list(knockouts),
        alpha = alpha
      )
      if (!is.null(model)) body$model <- model
      private$post("/api/fba", body)
    },

    #' @description
    #' List inventory items of a given type.
    #'
    #' @param item_type One of 'strains', 'plasmids', 'primers', 'chemicals', 'locations'.
    #' @param project_id Optional project filter.
    #' @param search Optional search term.
    #' @param limit Max items to return (default 200).
    #' @param offset Pagination offset.
    #'
    #' @return A list with `items` and `total` fields.
    list_inventory = function(item_type,
                              project_id = NULL,
                              search = NULL,
                              limit = 200,
                              offset = 0) {
      params <- list(limit = limit, offset = offset)
      if (!is.null(project_id)) params$projectId <- project_id
      if (!is.null(search)) params$search <- search
      private$get(paste0("/api/inventory/", item_type), params = params)
    },

    #' @description
    #' Create a new inventory item.
    #'
    #' @param item_type One of 'strains', 'plasmids', 'primers', 'chemicals', 'locations'.
    #' @param data Named list of item fields (must include 'name').
    #'
    #' @return A list representing the created item.
    create_inventory_item = function(item_type, data) {
      private$post(paste0("/api/inventory/", item_type), data)
    },

    #' @description
    #' Check API health.
    #'
    #' @return A list with `status`, `timestamp`, and `version`.
    health = function() {
      private$get("/api/health")
    },

    #' @description
    #' Fetch AlphaFold protein structure for a UniProt ID.
    #'
    #' @param uniprot_id UniProt accession (e.g. 'Q9AR04').
    #'
    #' @return A list with PDB structure data.
    analyze_protein = function(uniprot_id) {
      private$get("/api/alphafold", params = list(id = uniprot_id))
    },

    #' @description
    #' Look up a PubChem molecule by name or CID.
    #'
    #' @param name Compound name.
    #' @param cid PubChem Compound ID (integer).
    #'
    #' @return A list with molecule data.
    lookup_molecule = function(name = NULL, cid = NULL) {
      params <- list()
      if (!is.null(name)) params$name <- name
      if (!is.null(cid)) params$cid <- cid
      private$get("/api/pubchem", params = params)
    },

    #' @description
    #' Search the KEGG pathway database.
    #'
    #' @param query Search term.
    #'
    #' @return A list with search results.
    search_kegg = function(query) {
      private$get("/api/kegg", params = list(q = query))
    }
  ),

  private = list(

    # Internal GET helper with error handling.
    get = function(path, params = NULL) {
      url <- paste0(self$base_url, path)
      req <- httr2::request(url)
      req <- httr2::req_headers(req, `X-API-Key` = self$api_key)
      req <- httr2::req_timeout(req, self$timeout)

      if (!is.null(params)) {
        req <- httr2::req_url_query(req, !!!params)
      }

      resp <- httr2::req_perform(req)
      private$handle_response(resp)
    },

    # Internal POST helper with error handling.
    post = function(path, data) {
      url <- paste0(self$base_url, path)
      req <- httr2::request(url)
      req <- httr2::req_headers(req,
        `X-API-Key` = self$api_key,
        `Content-Type` = "application/json"
      )
      req <- httr2::req_body_json(req, data)
      req <- httr2::req_timeout(req, self$timeout)

      resp <- httr2::req_perform(req)
      private$handle_response(resp)
    },

    # Process response, raising structured errors on failure.
    handle_response = function(resp) {
      status <- httr2::resp_status(resp)

      if (status >= 200 && status < 300) {
        return(httr2::resp_body_json(resp))
      }

      body <- tryCatch(
        httr2::resp_body_json(resp),
        error = function(e) list(error = httr2::resp_body_string(resp))
      )

      message <- if (!is.null(body$error)) {
        body$error
      } else if (!is.null(body$message)) {
        body$message
      } else {
        paste("HTTP", status)
      }

      # Map HTTP status to error class
      if (status == 401 || status == 403) {
        stop(simpleError(
          message = paste0("AuthenticationError: ", message),
          class = "NexusBioAuthenticationError"
        ))
      } else if (status == 429) {
        retry_after <- httr2::resp_header(resp, "Retry-After")
        stop(simpleError(
          message = paste0("RateLimitError: ", message),
          class = "NexusBioRateLimitError"
        ))
      } else if (status == 400 || status == 422) {
        stop(simpleError(
          message = paste0("ValidationError: ", message),
          class = "NexusBioValidationError"
        ))
      } else if (status >= 500) {
        stop(simpleError(
          message = paste0("ServerError: ", message),
          class = "NexusBioServerError"
        ))
      }

      stop(simpleError(
        message = paste0("NexusBioError: ", message),
        class = "NexusBioError"
      ))
    }
  )
)
