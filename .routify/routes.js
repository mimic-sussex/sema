
/**
 * @roxi/routify 2.18.0
 * File generated Thu Jul 15 2021 14:54:44 GMT+0100 (British Summer Time)
 */

export const __version = "2.18.0"
export const __timestamp = "2021-07-15T13:54:44.004Z"

//buildRoutes
import { buildClientTree } from "@roxi/routify/runtime/buildRoutes"

//imports
import __fallback from '../src/pages/_fallback.svelte'
import _about_index from '../src/pages/about/index.svelte'
import _admin_index from '../src/pages/admin/index.svelte'
import _admin__layout from '../src/pages/admin/_layout.svelte'
import _docs__docId_index from '../src/pages/docs/[docId]/index.svelte'
import _docs__docId__layout from '../src/pages/docs/[docId]/_layout.svelte'
import _docs_CollapsibleSection from '../src/pages/docs/CollapsibleSection.svelte'
import _docs_index from '../src/pages/docs/index.svelte'
import _docs_sidebarMenu from '../src/pages/docs/sidebar-menu.svelte'
import _docs__layout from '../src/pages/docs/_layout.svelte'
import _index from '../src/pages/index.svelte'
import _login_index from '../src/pages/login/index.svelte'
import _login__layout from '../src/pages/login/_layout.svelte'
import _playground_index from '../src/pages/playground/index.svelte'
import _samples_index from '../src/pages/samples/index.svelte'
import _tutorial__chapter__section_index from '../src/pages/tutorial/[chapter]/[section]/index.svelte'
import _tutorial_index from '../src/pages/tutorial/index.svelte'
import _tutorial__layout from '../src/pages/tutorial/_layout.svelte'
import __layout from '../src/pages/_layout.svelte'

//options
export const options = {}

//tree
export const _tree = {
  "name": "_layout",
  "filepath": "/_layout.svelte",
  "root": true,
  "ownMeta": {},
  "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/_layout.svelte",
  "children": [
    {
      "isFile": true,
      "isDir": false,
      "file": "_fallback.svelte",
      "filepath": "/_fallback.svelte",
      "name": "_fallback",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/_fallback.svelte",
      "importPath": "../src/pages/_fallback.svelte",
      "isLayout": false,
      "isReset": false,
      "isIndex": false,
      "isFallback": true,
      "isPage": false,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/_fallback",
      "id": "__fallback",
      "component": () => __fallback
    },
    {
      "isFile": false,
      "isDir": true,
      "file": "about",
      "filepath": "/about",
      "name": "about",
      "ext": "",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/about",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/about/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/about/index.svelte",
          "importPath": "../src/pages/about/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/about/index",
          "id": "_about_index",
          "component": () => _about_index
        }
      ],
      "isLayout": false,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/about"
    },
    {
      "isFile": true,
      "isDir": true,
      "file": "_layout.svelte",
      "filepath": "/admin/_layout.svelte",
      "name": "_layout",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/admin/_layout.svelte",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/admin/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/admin/index.svelte",
          "importPath": "../src/pages/admin/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/admin/index",
          "id": "_admin_index",
          "component": () => _admin_index
        }
      ],
      "isLayout": true,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "importPath": "../src/pages/admin/_layout.svelte",
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/admin",
      "id": "_admin__layout",
      "component": () => _admin__layout
    },
    {
      "isFile": true,
      "isDir": true,
      "file": "_layout.svelte",
      "filepath": "/docs/_layout.svelte",
      "name": "_layout",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/docs/_layout.svelte",
      "children": [
        {
          "isFile": true,
          "isDir": true,
          "file": "_layout.svelte",
          "filepath": "/docs/[docId]/_layout.svelte",
          "name": "_layout",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/docs/[docId]/_layout.svelte",
          "children": [
            {
              "isFile": true,
              "isDir": false,
              "file": "index.svelte",
              "filepath": "/docs/[docId]/index.svelte",
              "name": "index",
              "ext": "svelte",
              "badExt": false,
              "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/docs/[docId]/index.svelte",
              "importPath": "../src/pages/docs/[docId]/index.svelte",
              "isLayout": false,
              "isReset": false,
              "isIndex": true,
              "isFallback": false,
              "isPage": true,
              "ownMeta": {},
              "meta": {
                "recursive": true,
                "preload": false,
                "prerender": true
              },
              "path": "/docs/:docId/index",
              "id": "_docs__docId_index",
              "component": () => _docs__docId_index
            }
          ],
          "isLayout": true,
          "isReset": false,
          "isIndex": false,
          "isFallback": false,
          "isPage": false,
          "importPath": "../src/pages/docs/[docId]/_layout.svelte",
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/docs/:docId",
          "id": "_docs__docId__layout",
          "component": () => _docs__docId__layout
        },
        {
          "isFile": true,
          "isDir": false,
          "file": "CollapsibleSection.svelte",
          "filepath": "/docs/CollapsibleSection.svelte",
          "name": "CollapsibleSection",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/docs/CollapsibleSection.svelte",
          "importPath": "../src/pages/docs/CollapsibleSection.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": false,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/docs/CollapsibleSection",
          "id": "_docs_CollapsibleSection",
          "component": () => _docs_CollapsibleSection
        },
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/docs/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/docs/index.svelte",
          "importPath": "../src/pages/docs/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/docs/index",
          "id": "_docs_index",
          "component": () => _docs_index
        },
        {
          "isFile": true,
          "isDir": false,
          "file": "sidebar-menu.svelte",
          "filepath": "/docs/sidebar-menu.svelte",
          "name": "sidebar-menu",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/docs/sidebar-menu.svelte",
          "importPath": "../src/pages/docs/sidebar-menu.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": false,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/docs/sidebar-menu",
          "id": "_docs_sidebarMenu",
          "component": () => _docs_sidebarMenu
        }
      ],
      "isLayout": true,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "importPath": "../src/pages/docs/_layout.svelte",
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/docs",
      "id": "_docs__layout",
      "component": () => _docs__layout
    },
    {
      "isFile": true,
      "isDir": false,
      "file": "index.svelte",
      "filepath": "/index.svelte",
      "name": "index",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/index.svelte",
      "importPath": "../src/pages/index.svelte",
      "isLayout": false,
      "isReset": false,
      "isIndex": true,
      "isFallback": false,
      "isPage": true,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/index",
      "id": "_index",
      "component": () => _index
    },
    {
      "isFile": true,
      "isDir": true,
      "file": "_layout.svelte",
      "filepath": "/login/_layout.svelte",
      "name": "_layout",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/login/_layout.svelte",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/login/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/login/index.svelte",
          "importPath": "../src/pages/login/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/login/index",
          "id": "_login_index",
          "component": () => _login_index
        }
      ],
      "isLayout": true,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "importPath": "../src/pages/login/_layout.svelte",
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/login",
      "id": "_login__layout",
      "component": () => _login__layout
    },
    {
      "isFile": false,
      "isDir": true,
      "file": "playground",
      "filepath": "/playground",
      "name": "playground",
      "ext": "",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/playground",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/playground/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/playground/index.svelte",
          "importPath": "../src/pages/playground/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/playground/index",
          "id": "_playground_index",
          "component": () => _playground_index
        }
      ],
      "isLayout": false,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/playground"
    },
    {
      "isFile": false,
      "isDir": true,
      "file": "samples",
      "filepath": "/samples",
      "name": "samples",
      "ext": "",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/samples",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/samples/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/samples/index.svelte",
          "importPath": "../src/pages/samples/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/samples/index",
          "id": "_samples_index",
          "component": () => _samples_index
        }
      ],
      "isLayout": false,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/samples"
    },
    {
      "isFile": true,
      "isDir": true,
      "file": "_layout.svelte",
      "filepath": "/tutorial/_layout.svelte",
      "name": "_layout",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/tutorial/_layout.svelte",
      "children": [
        {
          "isFile": false,
          "isDir": true,
          "file": "[chapter]",
          "filepath": "/tutorial/[chapter]",
          "name": "[chapter]",
          "ext": "",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/tutorial/[chapter]",
          "children": [
            {
              "isFile": false,
              "isDir": true,
              "file": "[section]",
              "filepath": "/tutorial/[chapter]/[section]",
              "name": "[section]",
              "ext": "",
              "badExt": false,
              "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/tutorial/[chapter]/[section]",
              "children": [
                {
                  "isFile": true,
                  "isDir": false,
                  "file": "index.svelte",
                  "filepath": "/tutorial/[chapter]/[section]/index.svelte",
                  "name": "index",
                  "ext": "svelte",
                  "badExt": false,
                  "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/tutorial/[chapter]/[section]/index.svelte",
                  "importPath": "../src/pages/tutorial/[chapter]/[section]/index.svelte",
                  "isLayout": false,
                  "isReset": false,
                  "isIndex": true,
                  "isFallback": false,
                  "isPage": true,
                  "ownMeta": {},
                  "meta": {
                    "recursive": true,
                    "preload": false,
                    "prerender": true
                  },
                  "path": "/tutorial/:chapter/:section/index",
                  "id": "_tutorial__chapter__section_index",
                  "component": () => _tutorial__chapter__section_index
                }
              ],
              "isLayout": false,
              "isReset": false,
              "isIndex": false,
              "isFallback": false,
              "isPage": false,
              "ownMeta": {},
              "meta": {
                "recursive": true,
                "preload": false,
                "prerender": true
              },
              "path": "/tutorial/:chapter/:section"
            }
          ],
          "isLayout": false,
          "isReset": false,
          "isIndex": false,
          "isFallback": false,
          "isPage": false,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/tutorial/:chapter"
        },
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/tutorial/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/francisco/Documents/dev/MIMIC/sema/src/pages/tutorial/index.svelte",
          "importPath": "../src/pages/tutorial/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/tutorial/index",
          "id": "_tutorial_index",
          "component": () => _tutorial_index
        }
      ],
      "isLayout": true,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "importPath": "../src/pages/tutorial/_layout.svelte",
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/tutorial",
      "id": "_tutorial__layout",
      "component": () => _tutorial__layout
    }
  ],
  "isLayout": true,
  "isReset": false,
  "isIndex": false,
  "isFallback": false,
  "isPage": false,
  "isFile": true,
  "file": "_layout.svelte",
  "ext": "svelte",
  "badExt": false,
  "importPath": "../src/pages/_layout.svelte",
  "meta": {
    "recursive": true,
    "preload": false,
    "prerender": true
  },
  "path": "/",
  "id": "__layout",
  "component": () => __layout
}


export const {tree, routes} = buildClientTree(_tree)

