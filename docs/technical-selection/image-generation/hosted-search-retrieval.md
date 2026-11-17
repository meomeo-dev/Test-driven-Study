# Hosted web search and source retrieval

Verified: 2026-11-02.

## Execution responsibility

Responses built-in `web_search` is hosted. The model chooses retrieval actions;
the service executes them and supplies retrieved information to the model during
the request. Direct OpenAI calls use OpenAI's infrastructure. An OpenAI-compatible
provider is responsible for delivering or forwarding that capability; the response
alone does not identify every underlying retrieval vendor.

The application does not execute `web_search_call` or return function outputs for
it. Custom function tools differ: the application executes its own functions and
returns their results. Remote MCP execution belongs to the configured MCP service
and Responses orchestration, rather than universally to application code.

## Returned evidence

| Field or action | Meaning and limit |
| --- | --- |
| `web_search_call.action.type: search` | A search action; not proof of reading every result in full. |
| `open_page` | A page-opening action, supported with reasoning models; not a guarantee that every section was extracted. |
| `find_in_page` | Searches within a page; useful for locating a relevant clause. |
| `web_search_call.action.sources` | Consulted/retrieved source URLs; request through `include`. Not a page-body archive. |
| `url_citation` annotations | Selected source URL/title and answer-text positions. Use for visible, clickable claim citations. |
| Final research text | Model conclusions based on available retrieval content; factual accuracy still requires assessment. |

Default output includes model text, action records and citation metadata. It does
not guarantee full HTML/plaintext for every source. The documented
`web_search_call.results` inclusion supports raw image results; it is not a
promise of complete text bodies for all consulted pages.

Live access is enabled by default for GA search. `external_web_access: false`
uses cached/indexed content. A source record therefore does not by itself prove
a fresh fetch or full-page reading. Preview search has different controls.

## Current application

The research request enables hosted search and asks for cited government sources.
A later structured synthesis receives the previous response output and research
notes, with source metadata supplied separately. It does not independently crawl
links. A URL string passed to a model without an enabled retrieval tool is not
an instruction that automatically downloads its content.

The durable record stores eligible source URLs/titles, completed search count,
research explanation and selected `url/title/claim` objects. It checks cited URLs
against actual returned records. It now saves research request counts, page-open/page-find counts and unresolved
evidence gaps. It does not save a raw page archive or independently verified
passages. Counts do not establish complete reading; older records without those
fields cannot reconstruct page activity.

The question 92082 success record contains 28 eligible source records and one
selected structured source claim. These quantities describe different things;
they do not establish 28 independently verified supporting documents.

## Recommended scope

Keep hosted retrieval for normal research. Do not add a general crawler solely
because Responses returns links. Use those links for attribution, review and
claim-level source navigation.

Insufficient assessments now automatically return to hosted research with the
specific gap. Existing sources do not disable the tool during supplementation.
Three consecutive research requests without new source/read-target activity stop
without images; useful new evidence can continue without a fixed total-round cap.
Source-title enrichment is preserved but does not count as new evidence. Repeated
page targets/patterns are normalized; changing tool-call IDs does not count. The
last gap is persisted before a terminal stagnation result.

For rules decisive to the answer, have the reasoning model inspect the relevant
primary document, locate the applicable passage, and report concise evidence,
effective date and necessary conditions. Preserve available search/open/find
records and citation annotations. Assess the passage's support for the claim;
URL matching and valid JSON alone cannot do that.

If reproducible source snapshots, offline review or independent passage validation
become requirements, retrieve only the selected documents through a separate
explicit process. Keep source URL, retrieval time, document hash and the evidence
used. Any application-side network retrieval must follow the existing explicit
proxy policy. Do not silently replace unreadable source text with invented facts.

The hosted-tool contract answers execution responsibility; it does not establish
that every compatible provider reproduces OpenAI's retrieval behavior exactly.

## Official references

- [Built-in execution versus function calling](https://developers.openai.com/tracks/building-agents#function-calling-vs-built-in-tools)
- [Web search output and citations](https://developers.openai.com/api/docs/guides/tools-web-search#output-and-citations)
- [Sources](https://developers.openai.com/api/docs/guides/tools-web-search#sources)
- [Live-access controls](https://developers.openai.com/api/docs/guides/tools-web-search#live-internet-access)
- [Raw image results](https://developers.openai.com/api/docs/guides/tools-web-search#image-search-results)
- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Remote MCP](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
