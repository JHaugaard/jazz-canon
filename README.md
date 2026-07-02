# jazz-canon-test

A benchmark packet: everything a model needs to build *The Jazz Canon* app
independently, without seeing the existing reference implementation. Built
2026-07-01 from the real, shipped `_jazzcanon` production dataset.

## What's in here

| Path | What it is |
|------|------------|
| `BRIEF.md` | The assignment — what to build, requirements, scope. Start here. |
| `style-guide.md` | Locked visual identity (color, type). Fixed constraint, not a starting point. |
| `brand/` | Logo mark, favicon, and lockup SVGs. |
| `db/schema.sql` | Full DDL for the `_jazzcanon` Postgres schema (tables, views, types). |
| `db/data.sql` | Data dump for every table **except** `album` and `person` (see below). |
| `db/album.csv`, `db/person.csv` | Data for those two tables, as plain CSV. |
| `docs/genre-definitions.md` | Canon scope rules (what counts as in/out of genre). |

**Not included, on purpose:** any application source code, the D3/force-graph
implementation, the timeline layout algorithm, component structure, or the
Disco UI-reference screenshots used as inspiration for the original build. The
point of this packet is to test independent execution of the brief in `BRIEF.md`
— handing over the solved UI would defeat that.

## Why `album`/`person` are split out

Both tables carry a `vector(768)` embedding column (pgvector, `hnsw` index) used
by a separate project's semantic-search tooling. It's irrelevant to this app and
would force an unnecessary `pgvector` extension dependency on whoever restores
this dump. `schema.sql` already has the embedding column and its indexes
stripped; `album.csv`/`person.csv` hold the same two tables' data with that
column omitted. No functionality needed by `BRIEF.md` depends on it.

## Restoring the database

Requires Postgres 16+ (no extensions needed — pgvector was stripped, see above).

```bash
createdb your_db_name
psql your_db_name -f db/schema.sql

# Load order matters for the FK-heavy tables. Simplest: disable FK checks
# for the load, then re-enable (all tables come from a single consistent
# production snapshot, so there's nothing to reconcile — this just avoids
# hand-ordering ~20 interdependent tables).
psql your_db_name <<'SQL'
SET session_replication_role = replica;
\i db/data.sql
\copy _jazzcanon.person(id,canonical_name,sort_name,name_slug,notes,search_document,created_at,updated_at) FROM 'db/person.csv' WITH (FORMAT csv, HEADER true)
\copy _jazzcanon.album(id,title,artist_name,leader_person_id,year,label_id,catalog_number,style_primary_id,recording_dates_text,multi_session,musicbrainz_release_group_mbid,musicbrainz_release_mbid,apple_album_id,consensus,canon_status,canon_tier,priority,inclusion_rationale,epistemic,notes,description,search_document,created_at,updated_at) FROM 'db/album.csv' WITH (FORMAT csv, HEADER true)
SET session_replication_role = default;
SQL
```

Verified 2026-07-01 against a scratch database: restores with zero errors,
100 albums / 567 people / 666 tracks / 670 performances / 20 labels, no
orphaned foreign keys.

If the model you're testing works better from flat files than a live Postgres
connection, this SQL is also straightforward to re-export as JSON/CSV per table
— that conversion itself is a fair thing to let the model do, or to do for it,
depending on what you're trying to measure.

## Using this with a model (e.g. Claude Fable 5)

Suggested framing when you hand this over:

> I'm going to give you a complete spec (`BRIEF.md`), a locked visual identity
> (`style-guide.md` + `brand/`), and a full database dump of real, curated data
> (`db/`). Build the app described in the brief from scratch: propose your
> stack, design the data-serving architecture, and build the UI/UX and the
> Personnel Network graph yourself. A reference implementation already exists
> but isn't part of this packet — I want to see your independent execution, not
> a reproduction. Ask me anything the brief doesn't answer, then go.

Attach or paste in the full contents of this directory (or point the model at
it if it has repo/file access) along with that framing.

## Provenance

Data dump pulled directly from the `_jazzcanon_ro` read-only role against the
production database on 2026-07-01 — the same data the shipped site runs on,
current as of that date. This is a point-in-time snapshot; re-run the dump
(see the reference site's `mccoy-tyner` scripts if you need a refresh) before
a future test run if meaningful time has passed and the canon has grown.
