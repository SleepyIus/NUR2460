# NUR2460 Study-Tool Update Report

**Update date:** August 24, 2026  
**Method:** Study Tool Synthesis Guide v2  
**Publication recommendation:** Draft branch only; course-scope alignment passes, clinical claim audit remains open

## Source Control Contract

```yaml
project_name: NUR2460 Family Nursing Care
course_term: Fall 2026
publication_status: draft
target_learner: NUR2460 nursing student
requested_depth: mixed
enrichment_level: restrained
synthesis_mode: course_synthesis

authorized_scope_sources:
  - Fall 2026 Class Schedule.pdf
  - NUR2460 Fall 2026 Syllabus.pdf

authorized_readable_clinical_sources:
  - Instructor's Notes.zip: 24 unique DOCX files, 398 rendered pages
  - OB and GYN-1.docx: 15 rendered pages

required_books_named_by_syllabus_but_not_supplied_as_readable_files:
  - Perry et al., Maternal Child Nursing Care, 7th edition
  - Fosbre, Varcarolis' Essentials of Psychiatric Mental Health Nursing, 5th edition
  - ATI Maternal Newborn, 11th edition
  - ATI Pharmacology, 8th edition
  - ATI Nursing Care of Children, 11th edition
  - ATI Mental Health, 11th edition

reference_artifacts_not_clinical_sources:
  - index.html
  - NUR2460StudyTool.html
  - NUR2460Pharmacology.html
  - NUR2460Flashcards.html

outside_model_knowledge_allowed: false
web_clinical_enrichment_allowed: false
conflict_policy: preserve and flag; do not reconcile, average, modernize, or correct without direct authorized support
public_repository_policy: do not publish instructor notes, copied slides, question screenshots, or third-party teaching graphics
```

The syllabus and schedule control course scope, dates, and required-resource identity. The readable instructor notes and medication handout may support only what they state. Existing HTML controls interaction patterns and learner identity, but it is not promoted to a clinical source.

## Readable Source Inventory

All DOCX files were rendered before review. Page counts below refer to the rendered documents.

| Exam | Week(s) | Instructor-note coverage | Files | Pages | Disposition |
|---|---:|---|---:|---:|---|
| 1 | 1–3 | Antepartum/prenatal; labor and delivery; healthy newborn; postpartum/family | 4 | 78 | Include for claim audit |
| 2 | 4–7 | High-risk pregnancy; high-risk L&D; high-risk newborn; GYN/infertility/STIs; growth/development; GI; integumentary | 8 | 170 | Include for claim audit |
| 3 | 8–10 | Musculoskeletal; neurological; respiratory; endocrine; cardiovascular; coagulation/hematology | 6 | 95 | Include for claim audit |
| 4 | 11–14 | Child/adolescent mental health; abuse/neglect; GU; immunity; oncology; MDD; bipolar | 6 | 55 | Include for claim audit |
| — | — | Reproductive and OB medications | 1 DOCX | 15 | Supplemental; Tier A claims require direct verification |

Archive QA found 24 unique DOCX files, no duplicate content hashes, and no document comments. The unnamed Week 12 instructor-note file was identified from its rendered title as **The Child with an Immunologic Alteration**.

The notes and medication handout contain embedded third-party graphics, mnemonics, and question screenshots. Those elements are omitted from the repository. Only written teaching points with exact locators may be synthesized.

## Course Coverage Baseline

The verified scope baseline is frozen at four exams and 24 instructor-note topics:

| Exam | Date | Official coverage mapped to stable hub topics | Coverage status |
|---|---|---|---|
| 1 | Sep 8 | Antepartum, prenatal care, healthy L&D, healthy newborn, postpartum/family | 11 existing topics mapped |
| 2 | Oct 6 | High-risk pregnancy, high-risk L&D, high-risk newborn, GYN, growth/development, GI, integumentary | 12 existing topics mapped |
| 3 | Oct 27 | Musculoskeletal, neurological, respiratory, endocrine, cardiovascular, coagulation/hematology | 11 existing topics mapped |
| 4 | Dec 1 | GU, immunity, oncology, abuse/neglect, child/adolescent mental health, MDD, bipolar | 8 existing topics mapped |

The 42 existing topic IDs remain the canonical learner-state identities. GYN/family planning/infertility/STI material remains under `contraception`; MDD and bipolar remain under `mood_disorders`. Labels now make those combined scopes explicit without splitting or invalidating saved progress.

ATI proctored milestones were also mapped: Maternal Newborn on Sep 29 and Oct 13; Nursing Care of Children on Nov 10 and Nov 17.

This freezes scope and identity, not clinical truth. A clinical fact baseline cannot be frozen until atomic claims are extracted and Tier A statements are directly supported.

## Medication Coverage and Disposition

The medication document is broader than a list. It covers reproductive hormones, contraception, osteoporosis therapy, fertility therapy, uterotonics, tocolytics, and antenatal corticosteroids.

### Existing records with direct name/class overlap

These imported records are retained for audit, not declared verified: combined oral contraceptives, medroxyprogesterone, clomiphene, folic acid, oxytocin, dinoprostone, misoprostol, methylergonovine, carboprost, indomethacin, nifedipine, magnesium sulfate, terbutaline, and betamethasone.

### Deferred additions

- Individual estrogen and progestin preparations beyond the existing contraception records
- Osteoporosis agents, including bisphosphonates and other bone-modifying therapies
- Gonadotropins, human chorionic gonadotropin products, and GnRH agonist/antagonist fertility agents
- Mifepristone and dexamethasone
- Instructor-note medications without dedicated cards, including ibuprofen, acetaminophen, tranexamic acid, and blood/clotting replacement products

These are deferred because separate cards would require supported action, indication, route, administration, contraindication, monitoring, teaching, and safety records. The handout includes historic or high-risk statements that cannot be copied forward uncritically.

## Unresolved Conflicts and Stop Conditions

- The syllabus requires Fosbre/Varcarolis, 5th edition, while the schedule uses a “Steele” reading label and the imported HTML cites Keltner, 9th edition. Psychiatric supplemental attribution remains unresolved.
- Davis's Drug Guide appears throughout the imported Pharmacology artifact but is not listed in the supplied syllabus and no edition/file was authorized. Those labels remain legacy attribution only.
- Existing HTML contains Tier A medication and numeric statements that have not yet been checked against readable primary sources. One example is inconsistent digoxin hold guidance within the same imported medication record.
- The medication handout contains historic contraception language and multiple dose/timing/route statements. None are promoted to verified status solely because they appear in the handout.
- The syllabus limits generative-AI use for course assignments. This repository must remain a personal study aid and should not be submitted as course work.

Affected clinical claims remain stopped. Course organization, learner-state maintenance, and other clearly separable work may continue.

## Implemented Alignment Pass

- Added a direct Fall 2026 course map to the hub with all four exam dates, weeks, official topic groupings, and links to the existing stable topics.
- Replaced inaccurate “books not bundled” messaging with the actual source inventory and a precise course-scope/clinical-audit distinction.
- Updated all four artifacts to explain that ATI/SUPP/Both badges are imported attribution labels until claim-level verification is complete.
- Preserved source references in topic and medication print output instead of hiding them in print mode.
- Made GYN, family planning, infertility, and STI scope explicit while preserving the `contraception` identity.
- Made the shared MDD/bipolar scope explicit while preserving `mood_disorders`.
- Added the missing Exam 4 option to the Flashcard browse filter.
- Corrected Exam 2 and Exam 3 initial planner totals.
- Corrected Exam 4 planner counter/bar element IDs so live progress updates reach them.
- Removed the inherited naloxone → `nas_meds` topic link; `nas_meds` is a medication record, not a Study Tool topic.
- Preserved the prior pilot's 275 stable flashcard IDs and legacy state migration.

No clinical claim, number, route, dose, timing, hold parameter, action, or rationale was intentionally rewritten in this alignment pass.

## Learner-State Contract

- Topic progress continues to use the original 42 topic IDs.
- Medication progress continues to use the original 67 drug IDs.
- Flashcards continue to use `fc-nur2460-001` through `fc-nur2460-275`.
- The legacy flashcard numeric-index migration and `nur2460_fc_state_version = 2` remain active.
- Export, import, and reset continue to cover the migrated state key.

## QA Status

- JavaScript parse: pass for all four HTML files.
- Static hub links: 45 checked; all target files and topic/drug query IDs resolve.
- Record counts: 42 unique topics, 67 unique medications, and 275 unique stable flashcard IDs.
- Planner coverage: 42 rows, all topics represented once; live totals render as 11 / 12 / 11 / 8 across Exams 1–4.
- Topic ↔ medication cross-links: all effective IDs resolve and relationships are symmetric; the invalid `nas_meds` topic edge was removed.
- Flashcard exam filters: 71 / 81 / 56 / 67 cards across Exams 1–4, totaling 275.
- Keyboard access: Enter reveals a browse-card answer; cards retain `tabindex="0"` and button semantics.
- Deep links: GYN topic, oxytocin, and naloxone opened correctly from URL parameters.
- Print provenance: the legacy-attribution warning and source-reference row remain visible under print-media rendering for both topics and medications.
- Responsive layout: pass at 390 × 844; one-column course map and no horizontal overflow.
- Browser console: no warnings or errors on the tested hub, Study Tool, Pharmacology, and Flashcard paths.
- Local server: all tested page requests returned 200/304; no missing local assets were requested.
- Learner-state identity: unchanged topic/drug IDs; 275 flashcard IDs remain unique; migration key remains present.

## Next Clinical Pass

Proceed exam by exam. For each topic: extract source-checked atomic facts with page locators; separate Tier A/B/C risk; resolve or preserve conflicts; freeze the verified topic baseline; then derive deep content, quick review, flashcards, and medication links from the shared records. Exam 1 should be audited first unless the learner requests a different priority.
