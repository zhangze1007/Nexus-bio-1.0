# Tests for NexusBioClient
#
# These tests verify client construction, method signatures, and
# error handling. They use webmockr or httptest2 for HTTP mocking
# when available, or test instantiation only in CI.

test_that("NexusBioClient can be instantiated", {
  # Skip if R6 or httr2 not installed
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(api_key = "test-key")
  expect_s3_class(client, "NexusBioClient")
  expect_equal(client$api_key, "test-key")
  expect_equal(client$base_url, "https://nexus-bio-1-0.vercel.app")
})

test_that("NexusBioClient accepts custom base_url", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(
    api_key = "test-key",
    base_url = "http://localhost:3000"
  )
  expect_equal(client$base_url, "http://localhost:3000")
})

test_that("NexusBioClient strips trailing slashes from base_url", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(
    api_key = "test-key",
    base_url = "http://localhost:3000/"
  )
  expect_equal(client$base_url, "http://localhost:3000")
})

test_that("NexusBioClient accepts custom timeout", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(api_key = "test-key", timeout = 60)
  expect_equal(client$timeout, 60)
})

test_that("NexusBioClient rejects empty api_key", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  expect_error(
    NexusBioClient$new(api_key = ""),
    "is.character"
  )
})

test_that("NexusBioClient has all public methods", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(api_key = "test-key")

  expect_true(is.function(client$analyze))
  expect_true(is.function(client$list_projects))
  expect_true(is.function(client$run_fba))
  expect_true(is.function(client$list_inventory))
  expect_true(is.function(client$create_inventory_item))
  expect_true(is.function(client$health))
  expect_true(is.function(client$analyze_protein))
  expect_true(is.function(client$lookup_molecule))
  expect_true(is.function(client$search_kegg))
})

test_that("analyze method accepts expected parameters", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(api_key = "test-key")

  # Verify the method signature accepts these args (doesn't call API)
  args <- names(formals(client$analyze))
  expect_true("prompt" %in% args)
  expect_true("context" %in% args)
  expect_true("history" %in% args)
  expect_true("search_query" %in% args)
})

test_that("run_fba method accepts expected parameters", {
  skip_if_not_installed("R6")
  skip_if_not_installed("httr2")

  client <- NexusBioClient$new(api_key = "test-key")

  args <- names(formals(client$run_fba))
  expect_true("objective" %in% args)
  expect_true("species" %in% args)
  expect_true("mode" %in% args)
  expect_true("action" %in% args)
  expect_true("knockouts" %in% args)
  expect_true("alpha" %in% args)
})
