# Owner CMS: add instructions to an explanatory section

Date: 5 October 2026 (Asia/Singapore)

## Problem and behaviour

The owner could not add an instruction to a section that originally contained only explanatory text. Both the contextual editor and the secondary editor disabled Add instruction for those sections. Enabling the button alone would also switch publication and Guide preview into a different answer mapping, potentially combining separate existing answers.

The narrow correction allows the first numbered instruction and keeps each existing non-procedure Guide answer mapped to its own paragraph. Common numbered instructions, notes and reviewed video transcripts accompany that paragraph consistently in preview and publication. Existing fact identities, kinds, access levels and routing remain unchanged. The paragraph-count restriction, pending-operation locks, 60-step limit, nonblank validation, stable attachment identities and minimum instructions for an existing procedure remain enforced.

## Verification and release contract

The reported HC-01 empty section is covered by enabled-control, add/edit, serialized round-trip, publication/compiler and stable video-placement regressions. A two-answer specimen proves that sibling paragraphs stay separate and preview agrees with compiled answers. Removing the last optional instruction restores the original answers. The original four failing regressions are retained privately.

Independent source review found no blocking runtime defect. A new whole-output comparison initially used the raw canonical library rather than the CMS-normalized library and failed on existing category-order metadata. That failed attempt is retained; a separate exact prepatch/postpatch comparison of the complete normalized publication and every compiled field passes without excluding fields: 48 articles and 196 facts. This is local automated evidence, not a live owner write or physical-phone test.

Full local quality passes: CMS 71/71, server 1,146/1,146, client 921/921 plus five environment checks, compiler 12/12, static checks and the production client build. Locked map checks pass 104/104; reviewed Worker packaging dry-run passes without an upload. The first browser harness expected a disabled blank-step Save button; the existing editor instead validates on Save. That harness expectation was corrected to require visible refusal and no fixture save request, while retaining the original failed attempt. Browser acceptance and production proof are recorded separately in the final local handoff.

Final intercepted browser acceptance passes at desktop 1,440 px and phone width 390 px: add the first HC-01 instruction, refuse a blank save without a request, block Add/Save during pending text, apply text, compare Guide preview, save/reload with stable identity, and remove/save back to the exact original section. No horizontal overflow, runtime errors or unexpected fixture writes occurred. Both earlier harness failures (the disabled-button expectation and an insufficient state-settlement wait) remain retained. These are fictional intercepted API writes and automated phone-width checks, not production content writes or physical-device evidence.

Release preserves the latest private published Help library and saved workspace. The public repository baseline must not replace live CMS content. Commit/push and production delivery use the previously approved CMS release scope, the current public source pin, and the normal private publisher with the same already-approved content. No synthetic instructions, articles or media are published for acceptance. Runtime release, paired artifact delivery, owner enabled-control checks and final lock/workspace checks remain required after the local gates pass.

After release, refresh the live Help Centre, open an article, select Edit this article and use Add instruction in an explanatory section. Apply the text before saving. Genuine content changes remain private until the owner reviews and publishes them.
