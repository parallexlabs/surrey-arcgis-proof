# Build log

Historical build evidence follows. Author/reviewer identities and request/job identifiers are retained in the private ledger. Text-only repository hygiene on 2026-10-06 updates attribution and direct specification hash pins; historical build, test and review results remain as recorded.

2026-10-06: Read BRIEF_BUILD.md, both local plans, and the shared authoring service reminder. Authoring and review coordinated. No matching existing ArcGIS build answer found in the bridge outbox. Initial repository has no commits or application files; brief and plans are already excluded by git.

SPEC.md v1 frozen before application authoring. Node 22.15.1 available. Public fixtures copied without altering features; data provenance retains original retrieval dates. Esri licensing documentation does not establish unconditional account-free production use; the spec requires bounded wording and a deployment licensing verification item.

Authoring and review coordinated. Batch 1 request: configuration, pure model and data validation, local version files. Admitted 22:41 UTC; queued behind shared provider account capacity. No duplicate submitted. Live catalog advertises the assigned author but execution identity remains unconfirmed until a terminal receipt.

Additional licensing evidence: Esri E300 dated November 13, 2025, footnotes 63 and 64 require web deployments to be used in conjunction with other Esri products. Source: https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf . A runtime without credentials does not establish a deployment entitlement. Automated browser tests must intercept OSM tiles; OSM tile policy prohibits headless bots panning/zooming to force tile rendering.

23:00 UTC: batch 1 failed `provider_non_answer` with an empty body. Receipt reports delivered `primary author`, provider_contacted true, 8 plan goals and 34 web results; no code installed. This is an authoring failure, not a failed code fix round. The October 6 owner retry directive authorizes a new distinct request after 3–5 minutes. Retry will narrow to package/Vite/TypeScript configuration only and explicitly request code without web research. Original idempotency key will not be replayed.

23:03 UTC: owner-authorized retry submitted as, configuration-only three-file batch, same required author, no web research requested. SPEC.md staged attachment hash verified; guard allowed the spec.

Retry job; staged spec delivery accepted, awaiting provider slot. Independent unit-test request key returned a tool-call error before a job was created (read-only exact-key job-store lookup returned no row). Live fleet allowance was full (6/6); no test files or provider response claimed. Submit the second-author packet only after capacity changes, rather than replaying a refused request without change.

Independent unit-test contract admitted after fleet allowance changed to 12: request, author `independent test author`, spec attachment accepted. Two own requests in flight: configuration retry and unit tests. Unit contract supplies a deterministic pure-model API for the primary to implement once the tests return. No tests have been installed or passed yet.

23:18 UTC: configuration retry completed; provider reports delivered primary author. package.json, tsconfig.json, vite.config.ts installed byte-for-byte from full fenced file blocks. No application smoke claimed. npm install started, generating the dependency lock from returned pins. Latest owner-scoped thread handle retained locally for continuation.

Primary model batch request: same primary thread, spec attached, existing configuration and public source entries included; assigned author module, ESLint, ignore file, and v1/v2 demonstration corrections. No coordinator application-code edits.

npm install resolved all initial pins and generated package-lock.json. Configuration type check passed. Initial audit: 16 findings (1 moderate, 12 high, 3 critical) in development tools. Raw audit retained in _build/npm-audit-initial.json. Registry-confirmed compatible fixes include Vite 6.4.4, typescript-eslint 8.71.1, Vitest/coverage 4.1.11 (Node 22 and Vite 6 compatible), and Playwright 1.63.0. These must be returned by the primary author in a package fix; no manual package edits made.

23:20 UTC: independent unit suite completed; vitest.config.ts and tests/unit/model.test.ts installed byte-for-byte. Unit contract demands literal heightRule estimate/fallback, and version replay changing only heightM. The primary's pending batch will be reconciled against exact test output. No application module exists yet, so unit execution remains pending.

23:36 UTC: primary model batch completed (delivered primary confirmed); src/model.ts, eslint.config.js, .gitignore, public/data/updates/v1.json and v2.json installed byte-for-byte. Lint passed. Main type check found TS2345 at model.ts:309 (Record<string, unknown> inserted into Map<number, Project>). Unit run: 42 passed / 10 failed / 52; failed expectations concern only descriptive height rules and corrected provenance. Root accepts descriptive rules as better matching the frozen spec; second author must repair those expectations while retaining numerical, security, immutability, and rollback assertions. Root did not edit implementation or tests.

First compiler/audit fix request and test reconciliation request both refused pre-contact with caller_job_limit, provider_contacted false, no jobs created; live fleet allowance 6/6. Requests saved for submission after capacity changes. These admission refusals do not count as failed authoring service code-fix rounds. Existing-code context attachment , SHA256 2eb19e5d30eeb9688d61dfba247b5a0946ba64a1d90b802733dff950e87561e2.

23:39 UTC: one slot freed (5/6). Primary fix1 admitted as a job, spec and current context attachments accepted. This consumed the slot; independent test-fix1 admission again refused pre-contact at 6/6, no job created. It remains saved for the next capacity change. Orchestration continuity saved in ignored _build/orchestrator-state.json.

23:54 UTC: primary fix1 completed, delivered primary confirmed. Full model.ts and package.json installed byte-for-byte; no manual code edits. Package manager updates lockfile from new returned pins. Independent unit reconciliation admitted after the released slot: request, same second-author thread, spec and exact original code/test context attached.

Next loader/facts/UI-shell batch saved for admission:, primary continuation with latest code context attachment (SHA256 b31cf78fdd414de295eea807dd1dbd55b9ee27234eab4d2ea0517c89508b0d57) and frozen spec. No files from this batch exist yet.

Primary compiler fix1 verified: main type check and lint pass. Patched dependency installation failed inside npm 10.7.0 Arborist with `Cannot read properties of null (reading 'edgesOut')`; this is a toolchain resolver failure, not an application-code fix failure. Running registry-verified npm 11.21.0 through npx (compatible with Node 22.15.1) to generate the lock without changing the returned package pins or global tooling. The earlier audit run while installation had failed is not a final dependency result.

npm 11.21.0 install succeeded: exact requested pins resolved, updated generated lock, zero vulnerabilities. Default npm audit on the new lock also reports zero vulnerabilities (all severities); raw result _build/npm-audit-final-tools.json. Type check and lint pass again with the updated dependencies. esbuild 0.25.12 and Vitest 4.1.11 are available. No global tool upgrades or manual package edits.

00:16 UTC (October 7 UTC, still October 6 Pacific): independent unit fix1 completed; full tests/unit/model.test.ts installed byte-for-byte. Added meaningful validation, safe-link, deep clone, provenance, and repeated rollback checks; retained exact source facts and numerical assertions. Secondary author remains independent test author (provider-reported). Toolchain/model compiler and dependency fix passed in one admitted fix round; no coordinator glue edits.

00:17 UTC: unit gate passed: 187/187 tests. Model coverage statements/functions/lines 100%, branches 99.42% (173/174). Lint passes. UI/loader/browser work remains pending; this is the pure-model gate only. At the next admission read, other shared jobs had filled fleet allowance 6/6, so the prepared loader/facts/UI-shell packet still awaits submission.

00:20 UTC: loader/facts/UI-shell request admitted as a job; same primary thread, frozen spec and latest model/configuration context attached. Four requested files: src/data.ts, src/facts.ts, index.html, src/style.css. Current SDK dependency source confirms development telemetry uses vaadin.statistics.optout; request includes a pre-module opt-out to satisfy the no-analytics boundary. Source says production excludes that telemetry. SceneView/main wiring remains for the next primary batch.

00:36 UTC: loader/UI-shell batch completed; delivered primary confirmed. All four files installed byte-for-byte. Scene/main and loader tests are next. Fixed illustrative asset dimensions deliberately stay separate from the corrected application height. No coordinator code edits. Chromium test runtime installed.

00:36 UTC: primary scene/main request, and independent loader/facts test request, admitted with frozen SPEC and exact existing code attachment (SHA256 8774389cb7eeb88c8875ac1eeda63d1a2dbe52ae16c7ee160ae94a8486faf9bc). Two own requests in flight; no duplicate jobs.

SDK development telemetry verification: node_modules/@vaadin/vaadin-usage-statistics/vaadin-usage-statistics-collect.js checks localStorage.getItem(UsageStatistics.optOutKey) for truthiness (line 397), and the key is vaadin.statistics.optout (line 481). HTML bootstrap value true is sufficient; browser verification still pending.

00:39 UTC: clean npm ci using the default Node22/npm10 toolchain succeeded (261 packages; zero vulnerabilities), confirming generated lock reproducibility. Deprecation warnings for whatwg-encoding and pinned ESLint are recorded; no additional dependency edits made.

Footer link verification: Esri full-master-agreement URL resolves by redirect to its current Master Agreement page; Surrey licence URL resolves to Open Data License (text extraction unavailable). Current SDK licensing page confirms product-specific terms and Powered by Esri attribution. No HTML link fix needed.

00:53 UTC: independent loader/facts batch completed (delivered independent test author). Full data.test.ts, facts.test.ts and vitest.config.ts installed unchanged. Coverage now requires at least80% per file for model and loader. Expanded checks running.

00:52 UTC: expanded run passed295tests (187model+108loader), lint andtypecheck. facts.test.ts collection failed ENOENT /public/data/SOURCES.json because jsdom/Vitest rewrote import.meta.url resolution. Fix1 packet saved with exact failure and currentfacts/model/test/config/sourceattachment, SHA256 df8bd215d8d22096100e3955ee9fdbe2ca07ec12a42a49c95d3671f6595dfd4e. Admission refused pre-contact at fleet6/6; no fixjob created, no manualcodeedit. Will admit aftercapacitychange.

00:53 UTC: scene/main job completed, delivered primary confirmed, but response body truncates main.ts mid-function without a closing fence. Only complete scene.ts installed byte-for-byte; no partial main installed. Request full main again in same thread, together with any compiler fixes. This is incomplete author output, not a passed app batch.

00:53 UTC: scene module compiler/lint passed. Independent facts test fix1 admitted aftercapacitychange as job (). Fullmain recovery plusconciseREADME/CI/CFFpacket saved fornextcapacity; exactscenecontextattachment attkey recorded in localstate.

00:54 UTC: recovery/documentation batch admitted, latestprimarythread. Requested fullmain.ts plusREADME/CI/CFF; scene.ts alreadycompilesclean. Spec+currentcodeattachment SHA25653f207af07018eaae189dfc60813b268b31008b66ead9d25739bf20336b489b9 accepted. License/NOTICE/livevalidator remainnextbatch.

00:56 UTC: isolated model+loader coverage run passed295tests and per-file80%thresholds. Combined statements99.71%, branches99.35%, functions/lines100%; data.ts statements99.28%/branches99.25%; model.ts statements100%/branches99.42%. This is domaincoverageonly, notthefullsuite: facts collectionfixstillpending.

01:06 UTC: facts fixture-path fix1 completed; deliveredsecondauthorconfirmed. Fullfacts.test.ts installedunchanged; checkexpandedfullsuite.

01:06 UTC: fullunitgate passed347tests in3files, lintpasses; domaincoverageunchanged99.35%branches100%lines. Browserauthorpacket preparedagainstactualsceneAPIandexplicitmaincontract (mainbatchnowrunning). RequiresrealSceneView/119features/2meshes/popuplistparity/repeatedrollback/actualWebGLunavailable/axe0; allOSMtilerequestsinterceptedandunexpectedremotenetworkfails.

01:10 UTC: main/README/CI/CFF batch completed (deliveredprimaryconfirmed), all4fullfilesinstalledunchanged. Typecheck/lintPASS; productionbuildPASS (4425modules,23.50seconds), localSDKassetscopied. Browserbatch admitted, actualcompleteappcontext SHA256b413075afcd1b1b2a85cee0718053b9c500bdd87f93fd5e1cbebc2c732c1810b. License/NOTICE/livevalidator+READMEhashlinkfixpacketready. All3fixturechecksumspass. Productionrendernotverifiedyet.

01:14 UTC: discovered a different node service already listening on127.0.0.1:4173 (its proof route returns404); preserved it. Own localhostIPv6preview servedHTTP200 andwas stopped. Queuedbrowserjob cancelledbeforeproviderdispatch toreplaceobsoleteportpacket. CLI preview with --host127.0.0.1 --port4287 verifiedHTTP200 forours, thenstopped. Updatedbrowserrequest admitted, sameindependentthread, actualappcontext. Nootherprocesskilled orcodeauthoredlocally.

01:27 UTC: browser author nowrunning. Finallicense/livebatch admission refusedpre-contact atcaller8/8 evenfleetallowance12; nojobcreated. Packetretained, futureadmissionrequiresBOTHcallerandfleetavailability. Thisisnotacodefixfailure.

01:30 UTC: independentbrowserbatch completed(deliveredindependent test author), completeplaywright.config.ts andproof.spec.ts installedunchanged. CI-equivalentbrowserrunstartedusingownport4287,OSMinterceptionandactualSDKassertions. Finallicense/livebatch admitted; latestprimarythread,specandfullappcontextattached. Fourrequestedfiles LICENSE,NOTICE,live-smoke.mjs,READMEhashlinkfix.

01:35 UTC: firstfullbrowserrun1pass/2fail. ActualnoWebGLcasepasses keyboard2cycles/exactrollbackandaxe0; real3Dcases blockedonlybyextent129.00001567974687 versus129strictcomparison. Testauthorfix1admitted(,job). Screenshotinspected: actualdrawnscene, butshowcaseassettoo small atfullareaextent; primarypresentationfixneeded. LinkverificationfoundlegacyWEBLINKmissingdelimiter:encodedspaceforwarderHTTP500,correctyear&seqforwarderHTTP200 (noauthentication; downstreamportalappnottested). PlanboundedderivedURLrepairwithoriginalfixturesunchangedandregressiontests.

01:47 UTC: finalnoticesbatchreturnedall4completefiles,deliveredprimaryconfirmed; LICENSE NOTICE live-smoke.mjs READMEinstalledunchanged. Lintpasses. Firstlivevalidatorrun2/3pass:Citymetadata200,showcase207200no drift,Overpass400becauseauthorwroteunnamed[20]instead of[timeout:20]. Originalfailure receiptpreserved_build/live/final-run.json.

01:49 UTC: primaryrecord/livefix1 admitted,job,latestprimarythreadwithcurrentcode+publicfailurereceipt. Requestedfullmodel/README/live-script: narrow119legacyrecordlinknormalization andexactQLsyntaxfix. Independentbrowserextentfix1completedandfullproof.spec.ts installedunchanged; rerunbrowsergates.

01:50 UTC: independent record-link regression request, admitted with the frozen spec and actual model/fixture context. Primary record/live fix and independent regressions are the only two own jobs in flight.

01:51 UTC: second browser run: two pass, one fails only at strict console-audit teardown. Both full-page axe cases report zero violations; actual WebGL-denied list and versions pass. The real-scene test completes actual popup/list parity, two correction/rollback cycles, unchanged source facts and exact baseline restoration, but emits four FeatureViewModel popup errors during layer replacement. Local SDK declarations confirm Popup.clear removes retained features and promises whereas close merely hides. Primary must repair lifecycle, preserve strict console checks, and improve the existing showcase camera in the same full scene file. No tests or application code edited locally.

01:59 UTC: primary record/live fix1 returned three complete files, installed unchanged. Link normalization is narrow and preserves all raw source fixtures. Live fix round1 still fails: query construction is now correct, but added startsWith validation expects the original incorrect [20] setting and rejects it before the Overpass request. Exact failure and actual files attached to a prepared combined scene/lifecycle/presentation plus live guard fix2 packet. No local code edits.

02:00 UTC: combined primary scene/lifecycle/presentation and live guard fix2 admitted, latest primary continuation with spec and exact 104174-byte context (SHA256 4de2a53b3368846bc21cb5aaa97d86365987b8205b321839a80422cf02bccdfb). Existing 347 unit tests, lint and typecheck pass after link repair; new independent regressions still running. Current domain coverage remains above80% in each file.

02:00 UTC: independent record-link regression batch completed (provider reports independent test author); full tests/unit/record-links.test.ts installed byte-for-byte. Full suite 406/406 passes, lint/typecheck pass. All 119 actual raw links and source facts preserved, canonical derived links validated, repeated exact rollback and hostile URL cases checked offline. Domain coverage statements99.44%, branches98.77%, functions/lines100%; each model/loader file exceeds80%.

02:18 UTC: primary scene/live fix2 completed; both full scene.ts and live-smoke.mjs installed byte-for-byte, delivered primary confirmed. Scene clears retained popup features before replacement, focuses the existing camera on showcase/source locations, and uses a constant safe popup title. Lint/typecheck pass. Live script now passes3/3 at02:18:37–02:18:42UTC: City metadata200, record207200/no selected-field drift, bounded Gateway Overpass node200. No live OSM tile requests. Full production/browser rerun follows.

02:20 UTC: production rebuild passes (4425 modules,24.19 seconds); all three Playwright cases pass in36.1 seconds. Strict audit confirms no SDK/application console errors, unhandled exceptions, unexpected remote services or local asset failures. Actual SceneView, all119 applications,17stations/208lines, two physical meshes, popup/list parity and v2/v1 repeated exact rollback pass. Full-page real-scene and actual WebGL-denied axe scans each report zero violations. Actual SDK screenshot and map capture inspected: showcase and illustrative podium/tower visible in focused camera; OSM tiles are intercepted and no live tile delivery is claimed. Live service run documented separately. Preliminary full-repo confidentiality guard passed; final pack refreshed before review.

02:21 UTC: final review version1 contains all35 tracked files, generated-lock summary and frozen GeoJSON summary supplement. Required packing script used; local confidentiality guard returned allowed, no matches, complete extraction. Final pack255206bytes, SHA256 f811c5831efdfde44266608cd2070b4908aaab0a82c0229b8993bc57b9128a8f. Both requested final reviewers admitted with this exact pack and frozen spec:, job, first independent reviewer;, job, second independent reviewer. No review response or final approval claimed yet.

02:43 UTC: both final full-repo reviews completed, assigned/delivered authors confirmed. first independent reviewer: noHIGH,4MEDIUM,10LOW; second independent reviewer: noHIGH,3MEDIUM,noLOW. Full finding ledger/dispositions in untracked STATUS. Accepted test typechecking, automatic fixture hashes and consolidated failure/race/bfcache repairs; rejected removing required public provenance log, deferred source-map packaging preference, retained frozen-spec author provenance. first independent reviewer mistakenly described record-links.test.ts as summarised: required pack actually contains the full file, verified at pack line4829. second independent reviewer claimed a patch attachment but capture contains none; prepared same-thread patch-text remainder request, not a second review round.

02:41 UTC: primary review runtime fix1 admitted, latest primary continuation, spec and exact actual code/review context. Full scene/main requested. Strict test-type preflight confirms errors in proof.spec.ts and model.test.ts; these require independent-author full-file fixes without weakening assertions. Chromium153.0.8010.12 with --disable-webgl was locally probed and WebGL2 is actually unavailable. No live remote request used for that probe.

02:54 UTC: primary runtime review fix1 completed; full scene/main installed byte-for-byte. Shared operation queue, persisted lifecycle handling, diagnostic-before-model-commit and explicit failed-scene/list-only fallback are implemented. Lint/app typecheck pass; rebuild and normal browser rerun started. Accepted failure/interleaving regressions still require independent test-author files; no final repair validation claimed yet.

02:57 UTC: repaired primary modules pass rebuilt normal browser suite3/3 (38.3 seconds), strictconsole/networkaudit clean, bothaxe0. This is normal-path evidence; targeted simulated SDKfailure/interleaving/persisted-event regressions are prepared for independent author and remain pending. No actual browser bfcache eligibility claim.

03:12 UTC: shared allowance expanded after another caller finished; primary config/docs fix1 admitted; independent unit type/hash fix1 admitted, job. Exact prepared contexts/spec accepted. Two own requests in flight, no capacity bypass.

03:22 UTC: primary review config/docs fix1 completed; all6 fullfiles installed unchanged (new strict tsconfig.tests target, package scripts, CI failure artifacts, README assignment/fallback provenance, Markdown-pack ignore and own-code CFF licence qualifier). Source-map output remains intentional/deferred. Expanded typecheck still awaits independent full-test type fixes. Primary app/source changes remain independently authored only.

03:29 UTC: independent unit/hash fix1 completed; full model.test.ts and new fixture-hashes.test.ts installed unchanged. Strict browser-file type repair admitted, job. second independent reviewer same-review missing-patch remainder completed (job ); inline patch captured, no second full-repo review.

03:31 UTC: unit coverage remains99.44% statements/98.77% branches/100% functions and lines; all410 tests pass. Lint passes. second independent reviewer inline proposal matches the implemented diagnostic-before-commit/fallback/shared-queue/persisted-event repairs; no reviewer-authored application code installed. New independent lifecycle file admitted separately from the type-only proof-file repair, with no file overlap:, job; two own requests maximum.

03:32 UTC: clean default Node22 npm ci succeeds (261 packages), npm audit reports zero vulnerabilities. Final post-review live smoke passes3/3 at03:30:36.115–03:30:38.220UTC, allHTTP200, unchanged selected City source fields; docs/live-run updated with actual receipts/timestamps. Current29/29 independently authored files mechanically match returned blocks. Two independent browser-file requests remain queued; no commit yet.

03:35 UTC: independent proof-file type repair completed, full file installed unchanged. Strict app+all tests/configs typecheck and lint pass; assertions unchanged (explicit browser Window boundary and unused screenshot parameter removed). Final production rebuild passes; new lifecycle file still running.

03:38 UTC: independent lifecycle batch completed; full new file installed unchanged, strict typecheck/lint and410-unit coverage pass. Initial combined browser run exposed an actual first-update-before-popup failure: clearPopup calls clear on the SDK lazy popup placeholder (r.clear is not a function). The three intended fault hooks report hits0 because this unexpected failure occurs earlier. Primary full-scene repair admitted, same latest primary thread with spec and exact code/failure context. No assertions weakened or root code edits.

03:39 UTC: combined browser run5 pass/3 fail (all3normal, HR002race andHR003syntheticpersisted pass; HR001hooksblockedonlybyunexpectedlazyPopupclearfailure). Full pre-fix browser artifacts preserved in ignored_build/browser-pre-lazy-fix. Independent full-lifecycle extension admitted, job : retain all5 cases, add successful keyboard correction/exactrollback BEFOREfirstpopup, thenactualpopup/listparity. Primary fixesproduction; independentauthor fixes/tests own file; max2ownjobs.

03:44 UTC: primary lazy-popup fix1 completed, full scene.ts installed unchanged; explicit local SDK Popup widget initialized and checked rather than bypassing retained-feature clearing. Shared queue, strict lifecycle failure cleanup and diagnostics are retained. Targeted HR001 failure cases rerunning; independent normal-before-first-popup regression still running.

03:48 UTC: repaired real scene passes injected before-commit and after-current-switch failure/fallback assertions. Diagnostic-query case stillfails because its pre-load field-metadata guard neverinstalls thefault; scenevalidlycompletesv2READY135. Exact independent test-hook fix1 admitted, job. Required genuine loaded-layer hook/hits1 and alloriginalfallback assertions retained; no appchangesrequested. New independent normal pre-first-popup case installedunchanged and PASS13.9s (actualv2/v1beforefirstopen,119source-factsunchanged,exactrollback,firstpopup/listparity). Strict typecheck/lintpass.

03:51 UTC: independent diagnostic-hook fix1 completed; full lifecycle file installed unchanged. Only the non-firing injection branch changed: wait for genuine new loaded layer via original whenLayerView before installing the one-shot diagnostic rejection. All6cases/assertions retained. Final combined9-browser run started against rebuilt primaryscene, alongside final strict TS/lint/410-unit coverage. No root code edits.

## Final verification — 2026-10-07 03:53 UTC (October 6 evening Pacific)

Completed the frozen specification without adding product features. All application, loader, test, configuration, CI, README, licence/notice and citation files were installed from full author-returned blocks. The final 30 independently authored files match the returned bytes exactly; no coordinator application/test/glue edits were made. Frozen SPEC v1 and all three original public source hashes remain unchanged. Generated package-lock.json came from npm.

| Check | Final result |
| --- | --- |
| Node / clean installation | Node 22.15.1; default npm ci passes, 261 installed packages |
| Dependency audit | Zero vulnerabilities |
| Lint | Pass |
| Strict TypeScript | Application, every unit/browser test, Playwright and Vitest configurations pass |
| Unit tests | 410/410 in five files pass |
| Domain coverage | Statements 99.44%, branches 98.77%, functions 100%, lines 100%; each model/loader file exceeds 80% |
| Production build | Pass, 25.38 seconds after final application repair; local SDK assets and required base path |
| Browser tests | 9/9 pass in 1.7 minutes; actual SDK queries/rendering, popup parity, exact rollback, actual WebGL denial, three injected failures, held-query race, synthetic persisted events and first-popup regression |
| Accessibility | Zero full-page axe violations for both real scene and actual WebGL-denied list |
| Runtime/network audit | All nine strict audits pass: no SDK/application console errors, unhandled exceptions, unexpected remote services or failing local assets |
| Public live services | Final run 03:52:59.215–03:53:00.341 UTC; 3/3 checks pass, each HTTP 200; selected City fields unchanged |
| Frozen data / authorship | Three SHA256SUMS match; frozen spec unchanged; 30/30 authoring service files byte-exact |

Both required full-repo reviews were completed once each against the guarded version1 pack (255206 bytes; SHA256 f811c5831efdfde44266608cd2070b4908aaab0a82c0229b8993bc57b9128a8f). first independent reviewer returned 0 HIGH / 4 MEDIUM / 10 LOW; second independent reviewer returned 0 HIGH / 3 MEDIUM / 0 LOW. second independent reviewer's claimed missing patch attachment was recovered inline as a same-version remainder, not another full review. These are static review findings, not independent executions or subsequent approval of the repaired tree. Accepted repairs were authored through the required coding loop and verified locally.

Review dispositions: SAR-M1 rejected because the brief requires public build provenance and opaque request/job IDs are not credentials; SAR-L6 source-map packaging preference deferred; SAR-L10 intentional frozen-spec/provenance documentation retained. All other 14 findings accepted (with overlapping failure/lifecycle findings consolidated), implemented and validated. SAR-M4 used the safer explicit scene-close/list-only repair rather than swallowing readiness failures. SAR-L7 documents verified representative-point derivation and the bounded browser probe, not City-surveyed locations. CI evidence retention is configured; hosted CI was not run. The complete 17-row ledger is in untracked STATUS.md.

The added regressions exposed a real pre-first-popup lazy widget failure; the primary initialized a genuine local SDK Popup, and independent tests now prove normal correction/rollback before first opening, strict fallback on three one-shot real-SDK boundary failures, serialization, and exact list restoration. The diagnostic hook's original pre-load guard failed to install; the independent author moved it to the genuinely loaded layer boundary without weakening any assertion. Earlier failures and provider non-answers remain recorded above and in ignored local evidence.

OSM tiles were intercepted in all automated browser tests, so live tile delivery is not claimed. Injected SDK failures do not claim actual public-service outages. Persisted events were synthetic; actual browser BFCache eligibility was not tested. Only one canonical CitizenPortal forwarder pair was checked live; downstream portal/login and the other portal pages were not verified. Application deployment entitlement remains unresolved under the documented Esri terms. No public deployment, push, repository creation, City credentials, service writes or ArcGIS Online publication occurred. Source publication is separate from deploying the application.

Commit follows these successful checks under the configured user with a plain message; actual commit hash and the private ledger for all 29 requests/jobs are recorded in untracked STATUS.md. Original brief/plans and unrelated port4173 process were preserved. Provider costs/credits are unexposed and unknown.
