/** Shared type declaration for 3Dmol.js (loaded via CDN) */
export {};

declare global {
  interface $3DmolViewer {
    addModel: (data: string, format: string) => $3DmolModel;
    getModel: (index?: number) => $3DmolModel;
    setStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
    addStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
    addSurface: (type: number, options: Record<string, unknown>) => void;
    addCylinder: (options: Record<string, unknown>) => void;
    addLabel: (text: string, options: Record<string, unknown>) => unknown;
    removeAllLabels: () => void;
    removeAllShapes: () => void;
    selectedAtoms: (sel?: Record<string, unknown>) => Record<string, unknown>[];
    setHoverable: (
      sel: Record<string, unknown>,
      hoverable: boolean,
      hoverCallback?: (atom: Record<string, unknown>, viewer: $3DmolViewer, event: Record<string, unknown>) => void,
      unhoverCallback?: () => void,
    ) => void;
    setClickable: (
      sel: Record<string, unknown>,
      clickable: boolean,
      callback?: (atom: Record<string, unknown>, viewer: $3DmolViewer, event: Record<string, unknown>) => void,
    ) => void;
    zoomTo: (sel?: Record<string, unknown>) => void;
    zoom: (factor: number) => void;
    render: () => void;
    clear: () => void;
    resize: () => void;
    spin: (axis: string | boolean, speed?: number) => void;
    pngURI: () => string;
  }

  interface $3DmolModel {
    setStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
    selectedAtoms: (sel?: Record<string, unknown>) => Record<string, unknown>[];
  }

  interface Window {
    $3Dmol: {
      createViewer: (element: HTMLElement, config?: Record<string, unknown>) => $3DmolViewer;
      download: (query: string, viewer: $3DmolViewer, options?: Record<string, unknown>, callback?: () => void) => void;
      SurfaceType: {
        VDW: number;
        SAS: number;
        MS: number;
      };
    };
  }
}
