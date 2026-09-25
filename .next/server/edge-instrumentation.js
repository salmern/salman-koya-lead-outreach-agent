// runtime can't be in strict mode because a global variable is assign and maybe created.
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(self["webpackChunk_N_E"] = self["webpackChunk_N_E"] || []).push([["instrumentation"],{

/***/ "(instrument)/./instrumentation.ts":
/*!****************************!*\
  !*** ./instrumentation.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\n/**\n * Next.js instrumentation hook. Runs once per server process at startup.\n *\n * We start the in-process run worker here so confirmed runs get processed\n * without an external queue. This requires a long-lived Node server; see\n * docs/architecture.md for the serverless caveat.\n *\n * The import stays inside the `NEXT_RUNTIME === \"nodejs\"` branch so the Edge\n * compiler (middleware) can drop the Node-only dependency tree (apify-client\n * and friends).\n */ async function register() {\n    if (false) {}\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vaW5zdHJ1bWVudGF0aW9uLnRzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7Ozs7Ozs7OztDQVVDLEdBQ00sZUFBZUE7SUFDcEIsSUFBSUMsS0FBcUMsRUFBRSxFQUcxQztBQUNIIiwic291cmNlcyI6WyIvaG9tZS9zYWxtYW4vRGVza3RvcC9hYXQtYzMtd2Vlay01LWxlYWQtYWdlbnQvaW5zdHJ1bWVudGF0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTmV4dC5qcyBpbnN0cnVtZW50YXRpb24gaG9vay4gUnVucyBvbmNlIHBlciBzZXJ2ZXIgcHJvY2VzcyBhdCBzdGFydHVwLlxuICpcbiAqIFdlIHN0YXJ0IHRoZSBpbi1wcm9jZXNzIHJ1biB3b3JrZXIgaGVyZSBzbyBjb25maXJtZWQgcnVucyBnZXQgcHJvY2Vzc2VkXG4gKiB3aXRob3V0IGFuIGV4dGVybmFsIHF1ZXVlLiBUaGlzIHJlcXVpcmVzIGEgbG9uZy1saXZlZCBOb2RlIHNlcnZlcjsgc2VlXG4gKiBkb2NzL2FyY2hpdGVjdHVyZS5tZCBmb3IgdGhlIHNlcnZlcmxlc3MgY2F2ZWF0LlxuICpcbiAqIFRoZSBpbXBvcnQgc3RheXMgaW5zaWRlIHRoZSBgTkVYVF9SVU5USU1FID09PSBcIm5vZGVqc1wiYCBicmFuY2ggc28gdGhlIEVkZ2VcbiAqIGNvbXBpbGVyIChtaWRkbGV3YXJlKSBjYW4gZHJvcCB0aGUgTm9kZS1vbmx5IGRlcGVuZGVuY3kgdHJlZSAoYXBpZnktY2xpZW50XG4gKiBhbmQgZnJpZW5kcykuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWdpc3RlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5FWFRfUlVOVElNRSA9PT0gXCJub2RlanNcIikge1xuICAgIGNvbnN0IHsgc3RhcnRSdW5Xb3JrZXIgfSA9IGF3YWl0IGltcG9ydChcIkAvc2VydmVyL3J1bi13b3JrZXJcIik7XG4gICAgc3RhcnRSdW5Xb3JrZXIoKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbInJlZ2lzdGVyIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUlVOVElNRSIsInN0YXJ0UnVuV29ya2VyIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(instrument)/./instrumentation.ts\n");

/***/ })

},
/******/ __webpack_require__ => { // webpackRuntimeModules
/******/ var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
/******/ var __webpack_exports__ = (__webpack_exec__("(instrument)/./instrumentation.ts"));
/******/ (_ENTRIES = typeof _ENTRIES === "undefined" ? {} : _ENTRIES).middleware_instrumentation = __webpack_exports__;
/******/ }
]);