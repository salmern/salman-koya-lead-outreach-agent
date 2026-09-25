"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "instrumentation";
exports.ids = ["instrumentation"];
exports.modules = {

/***/ "(instrument)/./instrumentation.ts":
/*!****************************!*\
  !*** ./instrumentation.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\n/**\n * Next.js instrumentation hook. Runs once per server process at startup.\n *\n * We start the in-process run worker here so confirmed runs get processed\n * without an external queue. This requires a long-lived Node server; see\n * docs/architecture.md for the serverless caveat.\n *\n * The import stays inside the `NEXT_RUNTIME === \"nodejs\"` branch so the Edge\n * compiler (middleware) can drop the Node-only dependency tree (apify-client\n * and friends).\n */ async function register() {\n    if (true) {\n        const { startRunWorker } = await Promise.all(/*! import() */[__webpack_require__.e(\"vendor-chunks/@supabase\"), __webpack_require__.e(\"vendor-chunks/next\"), __webpack_require__.e(\"vendor-chunks/zod\"), __webpack_require__.e(\"vendor-chunks/tslib\"), __webpack_require__.e(\"vendor-chunks/tailwind-merge\"), __webpack_require__.e(\"vendor-chunks/iceberg-js\"), __webpack_require__.e(\"vendor-chunks/clsx\"), __webpack_require__.e(\"vendor-chunks/cookie\"), __webpack_require__.e(\"_instrument_server_run-worker_ts\")]).then(__webpack_require__.bind(__webpack_require__, /*! @/server/run-worker */ \"(instrument)/./server/run-worker.ts\"));\n        startRunWorker();\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vaW5zdHJ1bWVudGF0aW9uLnRzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7Ozs7Ozs7OztDQVVDLEdBQ00sZUFBZUE7SUFDcEIsSUFBSUMsSUFBcUMsRUFBRTtRQUN6QyxNQUFNLEVBQUVHLGNBQWMsRUFBRSxHQUFHLE1BQU0sNGtCQUE2QjtRQUM5REE7SUFDRjtBQUNGIiwic291cmNlcyI6WyIvaG9tZS9zYWxtYW4vRGVza3RvcC9hYXQtYzMtd2Vlay01LWxlYWQtYWdlbnQvaW5zdHJ1bWVudGF0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTmV4dC5qcyBpbnN0cnVtZW50YXRpb24gaG9vay4gUnVucyBvbmNlIHBlciBzZXJ2ZXIgcHJvY2VzcyBhdCBzdGFydHVwLlxuICpcbiAqIFdlIHN0YXJ0IHRoZSBpbi1wcm9jZXNzIHJ1biB3b3JrZXIgaGVyZSBzbyBjb25maXJtZWQgcnVucyBnZXQgcHJvY2Vzc2VkXG4gKiB3aXRob3V0IGFuIGV4dGVybmFsIHF1ZXVlLiBUaGlzIHJlcXVpcmVzIGEgbG9uZy1saXZlZCBOb2RlIHNlcnZlcjsgc2VlXG4gKiBkb2NzL2FyY2hpdGVjdHVyZS5tZCBmb3IgdGhlIHNlcnZlcmxlc3MgY2F2ZWF0LlxuICpcbiAqIFRoZSBpbXBvcnQgc3RheXMgaW5zaWRlIHRoZSBgTkVYVF9SVU5USU1FID09PSBcIm5vZGVqc1wiYCBicmFuY2ggc28gdGhlIEVkZ2VcbiAqIGNvbXBpbGVyIChtaWRkbGV3YXJlKSBjYW4gZHJvcCB0aGUgTm9kZS1vbmx5IGRlcGVuZGVuY3kgdHJlZSAoYXBpZnktY2xpZW50XG4gKiBhbmQgZnJpZW5kcykuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWdpc3RlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5FWFRfUlVOVElNRSA9PT0gXCJub2RlanNcIikge1xuICAgIGNvbnN0IHsgc3RhcnRSdW5Xb3JrZXIgfSA9IGF3YWl0IGltcG9ydChcIkAvc2VydmVyL3J1bi13b3JrZXJcIik7XG4gICAgc3RhcnRSdW5Xb3JrZXIoKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbInJlZ2lzdGVyIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUlVOVElNRSIsInN0YXJ0UnVuV29ya2VyIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(instrument)/./instrumentation.ts\n");

/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "@anthropic-ai/claude-agent-sdk":
/*!*************************************************!*\
  !*** external "@anthropic-ai/claude-agent-sdk" ***!
  \*************************************************/
/***/ ((module) => {

module.exports = import("@anthropic-ai/claude-agent-sdk");;

/***/ }),

/***/ "apify-client":
/*!*******************************!*\
  !*** external "apify-client" ***!
  \*******************************/
/***/ ((module) => {

module.exports = import("apify-client");;

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "node:dns/promises":
/*!************************************!*\
  !*** external "node:dns/promises" ***!
  \************************************/
/***/ ((module) => {

module.exports = require("node:dns/promises");

/***/ }),

/***/ "node:net":
/*!***************************!*\
  !*** external "node:net" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:net");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("./webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(instrument)/./instrumentation.ts"));
module.exports = __webpack_exports__;

})();