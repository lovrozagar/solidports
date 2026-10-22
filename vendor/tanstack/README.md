# TanStack Form preview for Solid 2

The Solid docs' form demos use `@tanstack/solid-form` with Solid 2 support, which npm does not publish yet (`latest` is 1.33.5 and `alpha` is 2.0.0-alpha.2, both built for Solid 1). `solid-form-pr2122-1db6f68.tgz` is the preview build of [TanStack/form#2122](https://github.com/TanStack/form/pull/2122) ("support Solid 2 beta") at its head, `1db6f68`: `@tanstack/solid-form` 1.33.0, peer `solid-js >=2.0.0-beta.15`. The repo installed it from `pkg.pr.new` until that host purged the build on 2026-10-22, when every install failed with a 404.

It is repacked from the installed package with its MIT license, unchanged but for one field: its `@tanstack/form-core` dependency named the purged `pkg.pr.new` build of the same commit, and now names the published `^1.33.0`, which resolves to the 1.33.5 that `@tanstack/react-form` already uses. The pull request does not touch `form-core`, so that build was upstream `form-core` 1.33.0.

Replace it with an npm release once TanStack Form publishes Solid 2 support.
