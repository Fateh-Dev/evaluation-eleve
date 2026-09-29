---
name: Generated API client TypeScript settings
description: TypeScript settings needed by the Orval React Query client in this workspace.
---

The generated React Query client uses `Headers.entries()`. The API client
package must include both `dom` and `dom.iterable` in its TypeScript `lib`
settings or workspace library typechecking fails after code generation.

**Why:** Orval regenerates header-normalization code that relies on iterable
DOM collection typings.

**How to apply:** Preserve the API client package's `dom.iterable` setting when
regenerating the shared client from OpenAPI.