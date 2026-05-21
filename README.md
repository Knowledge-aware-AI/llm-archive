# LLM-Archive GitHub Pages Snapshot

This folder is a static version of the response browser that can be deployed with GitHub Pages.

It does not require `serve_responses.mjs` or any backend API. The original API responses have been materialized as static JSON files under `data/`.

Open this folder through a local static server for testing so the browser can fetch the JSON files under `data/`.

## Deploy

Configure GitHub Pages to serve this folder, or copy its contents to the branch/folder used by GitHub Pages.

For a project page, the app is safe to serve from a subpath such as `/repository-name/` because all local assets and data files use relative URLs.

## Refresh

If prompts, model chains, responses, or analysis metrics change, regenerate this folder from the repository root so `data/response-catalogue.json`, `data/prompt-list.json`, `data/statistics.json`, and `data/responses/` match the latest snapshot.
