/** @type { import("../../../../web/scripts/app.js") } */
import { app } from '../../../scripts/app.js';
const { LGraphCanvas } = window;

// --- OPTIONS ---
const scrollZooming = false;    // <--- false = pan canvas, true = zoom canvas
const zoomSpeed = 0.15;         // Zoom speed for MOUSE (with Ctrl)
const touchpadZoomSpeed = 1;    // Zoom speed for TOUCHPAD (Pinch)
const allowPanningOverNonScrollableTextareas = true;

// --- KEYBOARD TRACKER ---
// Needed to distinguish real Ctrl from "phantom" Ctrl sent by browser during pinch
let isRealCtrlHeld = false;

window.addEventListener("keydown", (e) => {
    if (e.key === "Control" || e.metaKey) isRealCtrlHeld = true;
});
window.addEventListener("keyup", (e) => {
    if (e.key === "Control" || !e.metaKey) isRealCtrlHeld = false;
});
// Reset flag if switched to another window/tab
window.addEventListener("blur", () => isRealCtrlHeld = false);

// --- PAGE SWAP FIX ---
// Disable page swap with two fingers in macos.
document.addEventListener('wheel', function(e) {
    if (e.deltaX !== 0) {
        e.preventDefault();
    }
}, { passive: false });

// --- HELPER FUNCTIONS ---
const isNativeTouchpadPan = e => {
    if (e.wheelDeltaY !== undefined) {
        return Math.abs(e.wheelDeltaY) % 120 !== 0;
    }
    return e.deltaMode === 0;
};

const canTargetScroll = e => e.target.clientHeight < e.target.scrollHeight;
const oldProcessMouseWheel = LGraphCanvas.prototype.processMouseWheel;

let isPanning = false;
const enablePanning = () => isPanning = true;
const disablePanning = () => (isPanning = false, document.removeEventListener("pointermove", disablePanning))

const processMouseWheel = e => {
  const scale = app.canvas.ds.scale;

  // 1. DETECT GESTURE TYPE
  // Pinch has ctrlKey=true, but the physical key is not actually pressed
  const isPinchGesture = e.ctrlKey && !isRealCtrlHeld;
  
  // 2. SELECT ZOOM SPEED
  const currentSpeed = isPinchGesture ? touchpadZoomSpeed : zoomSpeed;
  
  let deltaZoom = 100 / currentSpeed / scale;

  // Logic for scrolling over text areas
  if (e.target.tagName === "TEXTAREA" && allowPanningOverNonScrollableTextareas && !canTargetScroll(e)) {
      enablePanning();
  }

  // Main Logic
  if (app.canvas.graph && app.canvas.allow_dragcanvas && isPanning) {
    document.addEventListener("pointermove", disablePanning);

    const isTouchpadPan = isNativeTouchpadPan(e);

    let { deltaX, deltaY } = e;
    // Support for horizontal scroll with Shift
    if (!isTouchpadPan && e.shiftKey) {
      deltaX = e.deltaY;
      deltaY = 0;
    }
    
    const shouldZoom = (isRealCtrlHeld) || isPinchGesture || (scrollZooming && !isTouchpadPan);

    if (shouldZoom) {
      // ZOOM CORRECTION
      if (e.metaKey) deltaZoom *= -1 / 0.5;
      
      e.preventDefault();
      app.canvas.ds.changeScale(scale - e.deltaY / deltaZoom, [e.clientX, e.clientY]);
      app.canvas.graph.change();
    } else {
        // PANNING (SCROLL)
        // Mouse wheel falls here if scrollZooming = false
        // And normal touchpad movement (two-finger pan)
        app.canvas.ds.mouseDrag(-deltaX, -deltaY);
    }
    
    app.canvas.graph.change();
    return false;
  } else {
    oldProcessMouseWheel.bind(app.canvas, e);
    if (e.ctrlKey) e.preventDefault();
    return true;
  }
};

app.canvasEl.parentElement.addEventListener("wheel", processMouseWheel);

LGraphCanvas.prototype.processMouseWheel = () => enablePanning();