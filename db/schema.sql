--
-- PostgreSQL database dump
--

\restrict BmVasjlUxPXfTGbUieeYvu79xZNwijtLwqKsHlffmbJOY87T9rgyZC09E9iRayg

-- Dumped from database version 16.14 (Ubuntu 16.14-1.pgdg24.04+1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _jazzcanon; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _jazzcanon;


--
-- Name: art_role; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.art_role AS ENUM (
    'front',
    'back',
    'liner',
    'disc',
    'alternate',
    'other'
);


--
-- Name: art_source; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.art_source AS ENUM (
    'cover-art-archive',
    'itunes',
    'discogs',
    'wikimedia',
    'manual',
    'other'
);


--
-- Name: canon_status; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.canon_status AS ENUM (
    'candidate',
    'included',
    'excluded'
);


--
-- Name: canon_tier; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.canon_tier AS ENUM (
    'consensus_core',
    'contested',
    'scope_call',
    'exclude_suggested'
);


--
-- Name: epistemic_label; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.epistemic_label AS ENUM (
    'obs',
    'inf',
    'unk'
);


--
-- Name: instrument_family; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.instrument_family AS ENUM (
    'brass',
    'woodwinds',
    'keyboards',
    'strings',
    'percussion',
    'other'
);


--
-- Name: performance_scope; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.performance_scope AS ENUM (
    'all-tracks',
    'selected-tracks',
    'unknown'
);


--
-- Name: priority_label; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.priority_label AS ENUM (
    'must_have',
    'strong',
    'consider'
);


--
-- Name: production_role; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.production_role AS ENUM (
    'producer',
    'engineer',
    'arranger',
    'mixing',
    'mastering',
    'supervisor',
    'other'
);


--
-- Name: source_type; Type: TYPE; Schema: _jazzcanon; Owner: -
--

CREATE TYPE _jazzcanon.source_type AS ENUM (
    'book',
    'web',
    'liner-notes',
    'discography',
    'other'
);


--
-- Name: fn_degrees_between(uuid, uuid); Type: FUNCTION; Schema: _jazzcanon; Owner: -
--

CREATE FUNCTION _jazzcanon.fn_degrees_between(person_a uuid, person_b uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    WITH RECURSIVE bfs(person_id, depth) AS (
        SELECT person_a, 0
        UNION
        SELECT CASE WHEN p2.person_id = b.person_id THEN p1.person_id
                    ELSE p2.person_id END,
               b.depth + 1
        FROM bfs b
        JOIN performance pa ON pa.person_id = b.person_id
        JOIN performance p1 ON p1.album_id = pa.album_id
        JOIN performance p2 ON p2.album_id = pa.album_id
        WHERE b.depth < 6
          AND (p1.person_id = b.person_id OR p2.person_id = b.person_id)
    )
    SELECT min(depth) FROM bfs WHERE person_id = person_b;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: album; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.album (
    id text NOT NULL,
    title text NOT NULL,
    artist_name text NOT NULL,
    leader_person_id uuid,
    year integer,
    label_id integer,
    catalog_number text DEFAULT ''::text NOT NULL,
    style_primary_id integer NOT NULL,
    recording_dates_text text,
    multi_session boolean DEFAULT false NOT NULL,
    musicbrainz_release_group_mbid text,
    musicbrainz_release_mbid text,
    apple_album_id text,
    consensus text,
    canon_status _jazzcanon.canon_status DEFAULT 'candidate'::_jazzcanon.canon_status NOT NULL,
    canon_tier _jazzcanon.canon_tier,
    priority _jazzcanon.priority_label,
    inclusion_rationale text,
    epistemic _jazzcanon.epistemic_label,
    notes text,
    description text,
    search_document text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT album_year_check CHECK (((year >= 1900) AND (year <= 2100)))
);


--
-- Name: album_art; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.album_art (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    album_id text NOT NULL,
    role _jazzcanon.art_role DEFAULT 'front'::_jazzcanon.art_role NOT NULL,
    source _jazzcanon.art_source NOT NULL,
    source_url text,
    local_path text,
    width integer,
    height integer,
    mime_type text,
    bytes integer,
    sha256 text,
    is_original_cover boolean,
    is_primary boolean DEFAULT false NOT NULL,
    epistemic _jazzcanon.epistemic_label DEFAULT 'obs'::_jazzcanon.epistemic_label NOT NULL,
    fetched_at timestamp with time zone,
    notes text
);


--
-- Name: album_collection; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.album_collection (
    album_id text NOT NULL,
    collection_id integer NOT NULL,
    "position" integer,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: album_style; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.album_style (
    album_id text NOT NULL,
    style_id integer NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: citation; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.citation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id integer NOT NULL,
    album_id text,
    performance_id uuid,
    track_id uuid,
    production_credit_id uuid,
    locator text,
    CONSTRAINT citation_check CHECK ((num_nonnulls(album_id, performance_id, track_id, production_credit_id) = 1))
);


--
-- Name: collection; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.collection (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_id_seq; Type: SEQUENCE; Schema: _jazzcanon; Owner: -
--

CREATE SEQUENCE _jazzcanon.collection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collection_id_seq; Type: SEQUENCE OWNED BY; Schema: _jazzcanon; Owner: -
--

ALTER SEQUENCE _jazzcanon.collection_id_seq OWNED BY _jazzcanon.collection.id;


--
-- Name: instrument; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.instrument (
    id integer NOT NULL,
    name text NOT NULL,
    family _jazzcanon.instrument_family NOT NULL
);


--
-- Name: instrument_id_seq; Type: SEQUENCE; Schema: _jazzcanon; Owner: -
--

CREATE SEQUENCE _jazzcanon.instrument_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: instrument_id_seq; Type: SEQUENCE OWNED BY; Schema: _jazzcanon; Owner: -
--

ALTER SEQUENCE _jazzcanon.instrument_id_seq OWNED BY _jazzcanon.instrument.id;


--
-- Name: label; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.label (
    id integer NOT NULL,
    name text NOT NULL,
    name_slug text NOT NULL,
    notes text
);


--
-- Name: label_id_seq; Type: SEQUENCE; Schema: _jazzcanon; Owner: -
--

CREATE SEQUENCE _jazzcanon.label_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: label_id_seq; Type: SEQUENCE OWNED BY; Schema: _jazzcanon; Owner: -
--

ALTER SEQUENCE _jazzcanon.label_id_seq OWNED BY _jazzcanon.label.id;


--
-- Name: performance; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    album_id text NOT NULL,
    person_id uuid NOT NULL,
    instrument_id integer NOT NULL,
    scope _jazzcanon.performance_scope DEFAULT 'all-tracks'::_jazzcanon.performance_scope NOT NULL,
    epistemic _jazzcanon.epistemic_label DEFAULT 'obs'::_jazzcanon.epistemic_label NOT NULL,
    notes text
);


--
-- Name: performance_session; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.performance_session (
    performance_id uuid NOT NULL,
    session_id uuid NOT NULL
);


--
-- Name: performance_track; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.performance_track (
    performance_id uuid NOT NULL,
    track_id uuid NOT NULL
);


--
-- Name: person; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canonical_name text NOT NULL,
    sort_name text,
    name_slug text NOT NULL,
    notes text,
    search_document text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: person_name_variant; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.person_name_variant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    variant_name text NOT NULL,
    source_note text
);


--
-- Name: production_credit; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.production_credit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    album_id text NOT NULL,
    session_id uuid,
    person_id uuid NOT NULL,
    role _jazzcanon.production_role NOT NULL,
    epistemic _jazzcanon.epistemic_label DEFAULT 'obs'::_jazzcanon.epistemic_label NOT NULL,
    notes text
);


--
-- Name: session; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    album_id text NOT NULL,
    session_date date,
    session_date_text text,
    studio_id integer,
    sequence integer,
    epistemic _jazzcanon.epistemic_label DEFAULT 'obs'::_jazzcanon.epistemic_label NOT NULL
);


--
-- Name: source; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.source (
    id integer NOT NULL,
    title text NOT NULL,
    source_type _jazzcanon.source_type NOT NULL,
    url text,
    notes text
);


--
-- Name: source_id_seq; Type: SEQUENCE; Schema: _jazzcanon; Owner: -
--

CREATE SEQUENCE _jazzcanon.source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: source_id_seq; Type: SEQUENCE OWNED BY; Schema: _jazzcanon; Owner: -
--

ALTER SEQUENCE _jazzcanon.source_id_seq OWNED BY _jazzcanon.source.id;


--
-- Name: studio; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.studio (
    id integer NOT NULL,
    name text NOT NULL,
    city text,
    lat numeric,
    lon numeric,
    name_slug text NOT NULL,
    notes text
);


--
-- Name: studio_id_seq; Type: SEQUENCE; Schema: _jazzcanon; Owner: -
--

CREATE SEQUENCE _jazzcanon.studio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: studio_id_seq; Type: SEQUENCE OWNED BY; Schema: _jazzcanon; Owner: -
--

ALTER SEQUENCE _jazzcanon.studio_id_seq OWNED BY _jazzcanon.studio.id;


--
-- Name: style; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.style (
    id integer NOT NULL,
    code text NOT NULL,
    display_name text NOT NULL,
    description text
);


--
-- Name: style_id_seq; Type: SEQUENCE; Schema: _jazzcanon; Owner: -
--

CREATE SEQUENCE _jazzcanon.style_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: style_id_seq; Type: SEQUENCE OWNED BY; Schema: _jazzcanon; Owner: -
--

ALTER SEQUENCE _jazzcanon.style_id_seq OWNED BY _jazzcanon.style.id;


--
-- Name: track; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.track (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    album_id text NOT NULL,
    session_id uuid,
    title text NOT NULL,
    track_number integer,
    side text,
    duration_text text,
    apple_track_id text,
    bonus_track boolean DEFAULT false NOT NULL,
    alternate_take boolean DEFAULT false NOT NULL,
    epistemic_track _jazzcanon.epistemic_label DEFAULT 'obs'::_jazzcanon.epistemic_label NOT NULL,
    CONSTRAINT track_side_check CHECK (((side = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text])) OR (side IS NULL)))
);


--
-- Name: track_composer; Type: TABLE; Schema: _jazzcanon; Owner: -
--

CREATE TABLE _jazzcanon.track_composer (
    track_id uuid NOT NULL,
    person_id uuid NOT NULL
);


--
-- Name: v_album_card; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_album_card AS
 SELECT a.id,
    a.title,
    a.artist_name,
    a.year,
    l.name AS label,
    s.display_name AS style_primary,
    a.canon_status,
    a.canon_tier,
    ( SELECT count(*) AS count
           FROM _jazzcanon.track t
          WHERE (t.album_id = a.id)) AS track_count,
    ( SELECT count(*) AS count
           FROM _jazzcanon.performance p
          WHERE (p.album_id = a.id)) AS personnel_count
   FROM ((_jazzcanon.album a
     LEFT JOIN _jazzcanon.label l ON ((l.id = a.label_id)))
     LEFT JOIN _jazzcanon.style s ON ((s.id = a.style_primary_id)));


--
-- Name: v_album_detail; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_album_detail AS
 SELECT a.id,
    a.title,
    a.artist_name,
    a.leader_person_id,
    a.year,
    a.label_id,
    a.catalog_number,
    a.style_primary_id,
    a.recording_dates_text,
    a.multi_session,
    a.musicbrainz_release_group_mbid,
    a.musicbrainz_release_mbid,
    a.apple_album_id,
    a.consensus,
    a.canon_status,
    a.canon_tier,
    a.priority,
    a.inclusion_rationale,
    a.epistemic,
    a.notes,
    a.description,
    a.search_document,
    a.created_at,
    a.updated_at,
    l.name AS label_name,
    s.display_name AS style_primary_name,
    lead.canonical_name AS leader_name
   FROM (((_jazzcanon.album a
     LEFT JOIN _jazzcanon.label l ON ((l.id = a.label_id)))
     LEFT JOIN _jazzcanon.style s ON ((s.id = a.style_primary_id)))
     LEFT JOIN _jazzcanon.person lead ON ((lead.id = a.leader_person_id)));


--
-- Name: v_album_personnel; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_album_personnel AS
 SELECT a.id AS album_id,
    a.title,
    pe.id AS person_id,
    pe.canonical_name,
    i.name AS instrument,
    i.family,
    p.scope,
    p.epistemic
   FROM (((_jazzcanon.performance p
     JOIN _jazzcanon.album a ON ((a.id = p.album_id)))
     JOIN _jazzcanon.person pe ON ((pe.id = p.person_id)))
     JOIN _jazzcanon.instrument i ON ((i.id = p.instrument_id)));


--
-- Name: v_album_primary_art; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_album_primary_art AS
 SELECT album_id,
    local_path,
    source,
    source_url,
    width,
    height,
    is_original_cover
   FROM _jazzcanon.album_art
  WHERE is_primary;


--
-- Name: v_album_search_source; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_album_search_source AS
 SELECT a.id AS album_id,
    a.title,
    a.artist_name,
    a.year,
    l.name AS label,
    s.display_name AS style,
    string_agg(DISTINCT (((pe.canonical_name || ' ('::text) || i.name) || ')'::text), ', '::text) AS personnel,
    a.notes
   FROM (((((_jazzcanon.album a
     LEFT JOIN _jazzcanon.label l ON ((l.id = a.label_id)))
     LEFT JOIN _jazzcanon.style s ON ((s.id = a.style_primary_id)))
     LEFT JOIN _jazzcanon.performance p ON ((p.album_id = a.id)))
     LEFT JOIN _jazzcanon.person pe ON ((pe.id = p.person_id)))
     LEFT JOIN _jazzcanon.instrument i ON ((i.id = p.instrument_id)))
  GROUP BY a.id, a.title, a.artist_name, a.year, l.name, s.display_name, a.notes;


--
-- Name: v_collection_albums; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_collection_albums AS
 SELECT c.slug AS collection_slug,
    c.name AS collection_name,
    ac."position",
    ac.added_at,
    a.id AS album_id,
    a.title,
    a.artist_name,
    a.year
   FROM ((_jazzcanon.album_collection ac
     JOIN _jazzcanon.collection c ON ((c.id = ac.collection_id)))
     JOIN _jazzcanon.album a ON ((a.id = ac.album_id)))
  ORDER BY c.slug, ac."position", a.year;


--
-- Name: v_composer_works; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_composer_works AS
 SELECT pe.id AS person_id,
    pe.canonical_name,
    t.album_id,
    a.title AS album_title,
    t.title AS track_title
   FROM (((_jazzcanon.track_composer tc
     JOIN _jazzcanon.person pe ON ((pe.id = tc.person_id)))
     JOIN _jazzcanon.track t ON ((t.id = tc.track_id)))
     JOIN _jazzcanon.album a ON ((a.id = t.album_id)));


--
-- Name: v_engineer_sessions; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_engineer_sessions AS
 SELECT pe.id AS person_id,
    pe.canonical_name,
    pc.role,
    a.id AS album_id,
    a.title,
    se.session_date
   FROM (((_jazzcanon.production_credit pc
     JOIN _jazzcanon.person pe ON ((pe.id = pc.person_id)))
     JOIN _jazzcanon.album a ON ((a.id = pc.album_id)))
     LEFT JOIN _jazzcanon.session se ON ((se.id = pc.session_id)));


--
-- Name: v_musician_albums; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_musician_albums AS
 SELECT pe.id AS person_id,
    pe.canonical_name,
    a.id AS album_id,
    a.title,
    a.year,
    string_agg(DISTINCT i.name, ', '::text ORDER BY i.name) AS instruments
   FROM (((_jazzcanon.person pe
     JOIN _jazzcanon.performance p ON ((p.person_id = pe.id)))
     JOIN _jazzcanon.album a ON ((a.id = p.album_id)))
     JOIN _jazzcanon.instrument i ON ((i.id = p.instrument_id)))
  GROUP BY pe.id, pe.canonical_name, a.id, a.title, a.year;


--
-- Name: v_musician_timeline; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_musician_timeline AS
 SELECT DISTINCT pe.id AS person_id,
    pe.canonical_name,
    se.session_date,
    a.id AS album_id,
    a.title
   FROM ((((_jazzcanon.person pe
     JOIN _jazzcanon.performance p ON ((p.person_id = pe.id)))
     JOIN _jazzcanon.performance_session ps ON ((ps.performance_id = p.id)))
     JOIN _jazzcanon.session se ON ((se.id = ps.session_id)))
     JOIN _jazzcanon.album a ON ((a.id = se.album_id)))
  WHERE (se.session_date IS NOT NULL);


--
-- Name: v_person_search_source; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_person_search_source AS
 SELECT pe.id AS person_id,
    pe.canonical_name,
    string_agg(DISTINCT i.name, ', '::text) AS instruments,
    string_agg(DISTINCT a.title, ', '::text) AS albums,
    min(a.year) AS first_year,
    max(a.year) AS last_year,
    pe.notes
   FROM (((_jazzcanon.person pe
     LEFT JOIN _jazzcanon.performance p ON ((p.person_id = pe.id)))
     LEFT JOIN _jazzcanon.instrument i ON ((i.id = p.instrument_id)))
     LEFT JOIN _jazzcanon.album a ON ((a.id = p.album_id)))
  GROUP BY pe.id, pe.canonical_name, pe.notes;


--
-- Name: v_sideman_network; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_sideman_network AS
 SELECT p1.person_id AS person_a,
    p2.person_id AS person_b,
    count(DISTINCT p1.album_id) AS shared_albums
   FROM (_jazzcanon.performance p1
     JOIN _jazzcanon.performance p2 ON (((p1.album_id = p2.album_id) AND (p1.person_id < p2.person_id))))
  GROUP BY p1.person_id, p2.person_id;


--
-- Name: v_track_personnel; Type: VIEW; Schema: _jazzcanon; Owner: -
--

CREATE VIEW _jazzcanon.v_track_personnel AS
 SELECT t.album_id,
    t.id AS track_id,
    t.title AS track_title,
    t.track_number,
    pe.id AS person_id,
    pe.canonical_name,
    i.name AS instrument,
    p.epistemic
   FROM (((_jazzcanon.track t
     JOIN _jazzcanon.performance p ON ((p.album_id = t.album_id)))
     JOIN _jazzcanon.person pe ON ((pe.id = p.person_id)))
     JOIN _jazzcanon.instrument i ON ((i.id = p.instrument_id)))
  WHERE ((p.scope = 'all-tracks'::_jazzcanon.performance_scope) OR (EXISTS ( SELECT 1
           FROM _jazzcanon.performance_track pt
          WHERE ((pt.performance_id = p.id) AND (pt.track_id = t.id)))));


--
-- Name: collection id; Type: DEFAULT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.collection ALTER COLUMN id SET DEFAULT nextval('_jazzcanon.collection_id_seq'::regclass);


--
-- Name: instrument id; Type: DEFAULT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.instrument ALTER COLUMN id SET DEFAULT nextval('_jazzcanon.instrument_id_seq'::regclass);


--
-- Name: label id; Type: DEFAULT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.label ALTER COLUMN id SET DEFAULT nextval('_jazzcanon.label_id_seq'::regclass);


--
-- Name: source id; Type: DEFAULT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.source ALTER COLUMN id SET DEFAULT nextval('_jazzcanon.source_id_seq'::regclass);


--
-- Name: studio id; Type: DEFAULT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.studio ALTER COLUMN id SET DEFAULT nextval('_jazzcanon.studio_id_seq'::regclass);


--
-- Name: style id; Type: DEFAULT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.style ALTER COLUMN id SET DEFAULT nextval('_jazzcanon.style_id_seq'::regclass);


--
-- Name: album_art album_art_album_id_role_source_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_art
    ADD CONSTRAINT album_art_album_id_role_source_key UNIQUE (album_id, role, source);


--
-- Name: album_art album_art_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_art
    ADD CONSTRAINT album_art_pkey PRIMARY KEY (id);


--
-- Name: album_collection album_collection_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_collection
    ADD CONSTRAINT album_collection_pkey PRIMARY KEY (album_id, collection_id);


--
-- Name: album album_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album
    ADD CONSTRAINT album_pkey PRIMARY KEY (id);


--
-- Name: album_style album_style_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_style
    ADD CONSTRAINT album_style_pkey PRIMARY KEY (album_id, style_id);


--
-- Name: citation citation_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.citation
    ADD CONSTRAINT citation_pkey PRIMARY KEY (id);


--
-- Name: collection collection_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.collection
    ADD CONSTRAINT collection_pkey PRIMARY KEY (id);


--
-- Name: collection collection_slug_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.collection
    ADD CONSTRAINT collection_slug_key UNIQUE (slug);


--
-- Name: instrument instrument_name_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.instrument
    ADD CONSTRAINT instrument_name_key UNIQUE (name);


--
-- Name: instrument instrument_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.instrument
    ADD CONSTRAINT instrument_pkey PRIMARY KEY (id);


--
-- Name: label label_name_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.label
    ADD CONSTRAINT label_name_key UNIQUE (name);


--
-- Name: label label_name_slug_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.label
    ADD CONSTRAINT label_name_slug_key UNIQUE (name_slug);


--
-- Name: label label_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.label
    ADD CONSTRAINT label_pkey PRIMARY KEY (id);


--
-- Name: performance performance_album_id_person_id_instrument_id_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance
    ADD CONSTRAINT performance_album_id_person_id_instrument_id_key UNIQUE (album_id, person_id, instrument_id);


--
-- Name: performance performance_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance
    ADD CONSTRAINT performance_pkey PRIMARY KEY (id);


--
-- Name: performance_session performance_session_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance_session
    ADD CONSTRAINT performance_session_pkey PRIMARY KEY (performance_id, session_id);


--
-- Name: performance_track performance_track_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance_track
    ADD CONSTRAINT performance_track_pkey PRIMARY KEY (performance_id, track_id);


--
-- Name: person person_canonical_name_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.person
    ADD CONSTRAINT person_canonical_name_key UNIQUE (canonical_name);


--
-- Name: person person_name_slug_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.person
    ADD CONSTRAINT person_name_slug_key UNIQUE (name_slug);


--
-- Name: person_name_variant person_name_variant_person_id_variant_name_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.person_name_variant
    ADD CONSTRAINT person_name_variant_person_id_variant_name_key UNIQUE (person_id, variant_name);


--
-- Name: person_name_variant person_name_variant_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.person_name_variant
    ADD CONSTRAINT person_name_variant_pkey PRIMARY KEY (id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);


--
-- Name: production_credit production_credit_album_id_person_id_role_session_id_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.production_credit
    ADD CONSTRAINT production_credit_album_id_person_id_role_session_id_key UNIQUE (album_id, person_id, role, session_id);


--
-- Name: production_credit production_credit_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.production_credit
    ADD CONSTRAINT production_credit_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: source source_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.source
    ADD CONSTRAINT source_pkey PRIMARY KEY (id);


--
-- Name: studio studio_name_city_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.studio
    ADD CONSTRAINT studio_name_city_key UNIQUE (name, city);


--
-- Name: studio studio_name_slug_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.studio
    ADD CONSTRAINT studio_name_slug_key UNIQUE (name_slug);


--
-- Name: studio studio_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.studio
    ADD CONSTRAINT studio_pkey PRIMARY KEY (id);


--
-- Name: style style_code_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.style
    ADD CONSTRAINT style_code_key UNIQUE (code);


--
-- Name: style style_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.style
    ADD CONSTRAINT style_pkey PRIMARY KEY (id);


--
-- Name: track track_album_id_track_number_alternate_take_key; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track
    ADD CONSTRAINT track_album_id_track_number_alternate_take_key UNIQUE (album_id, track_number, alternate_take);


--
-- Name: track_composer track_composer_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track_composer
    ADD CONSTRAINT track_composer_pkey PRIMARY KEY (track_id, person_id);


--
-- Name: track track_pkey; Type: CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track
    ADD CONSTRAINT track_pkey PRIMARY KEY (id);


--
-- Name: idx_album_art_album; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_album_art_album ON _jazzcanon.album_art USING btree (album_id);


--
-- Name: idx_album_canon; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_album_canon ON _jazzcanon.album USING btree (canon_status);


--
-- Name: idx_album_collection; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_album_collection ON _jazzcanon.album_collection USING btree (collection_id);


--


--
-- Name: idx_album_label; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_album_label ON _jazzcanon.album USING btree (label_id);


--
-- Name: idx_album_style; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_album_style ON _jazzcanon.album USING btree (style_primary_id);


--
-- Name: idx_album_year; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_album_year ON _jazzcanon.album USING btree (year);


--
-- Name: idx_citation_source; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_citation_source ON _jazzcanon.citation USING btree (source_id);


--
-- Name: idx_perf_album; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_perf_album ON _jazzcanon.performance USING btree (album_id);


--
-- Name: idx_perf_instrument; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_perf_instrument ON _jazzcanon.performance USING btree (instrument_id);


--
-- Name: idx_perf_person; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_perf_person ON _jazzcanon.performance USING btree (person_id);


--


--
-- Name: idx_prodcredit_album; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_prodcredit_album ON _jazzcanon.production_credit USING btree (album_id);


--
-- Name: idx_prodcredit_person; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_prodcredit_person ON _jazzcanon.production_credit USING btree (person_id);


--
-- Name: idx_prodcredit_role; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_prodcredit_role ON _jazzcanon.production_credit USING btree (role);


--
-- Name: idx_session_album; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_session_album ON _jazzcanon.session USING btree (album_id);


--
-- Name: idx_session_date; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_session_date ON _jazzcanon.session USING btree (session_date);


--
-- Name: idx_track_album; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_track_album ON _jazzcanon.track USING btree (album_id);


--
-- Name: idx_track_session; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE INDEX idx_track_session ON _jazzcanon.track USING btree (session_id);


--
-- Name: uq_album_art_primary; Type: INDEX; Schema: _jazzcanon; Owner: -
--

CREATE UNIQUE INDEX uq_album_art_primary ON _jazzcanon.album_art USING btree (album_id) WHERE is_primary;


--
-- Name: album_art album_art_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_art
    ADD CONSTRAINT album_art_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: album_collection album_collection_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_collection
    ADD CONSTRAINT album_collection_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: album_collection album_collection_collection_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_collection
    ADD CONSTRAINT album_collection_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES _jazzcanon.collection(id) ON DELETE CASCADE;


--
-- Name: album album_label_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album
    ADD CONSTRAINT album_label_id_fkey FOREIGN KEY (label_id) REFERENCES _jazzcanon.label(id);


--
-- Name: album album_leader_person_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album
    ADD CONSTRAINT album_leader_person_id_fkey FOREIGN KEY (leader_person_id) REFERENCES _jazzcanon.person(id) ON DELETE SET NULL;


--
-- Name: album_style album_style_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_style
    ADD CONSTRAINT album_style_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: album album_style_primary_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album
    ADD CONSTRAINT album_style_primary_id_fkey FOREIGN KEY (style_primary_id) REFERENCES _jazzcanon.style(id);


--
-- Name: album_style album_style_style_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.album_style
    ADD CONSTRAINT album_style_style_id_fkey FOREIGN KEY (style_id) REFERENCES _jazzcanon.style(id);


--
-- Name: citation citation_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.citation
    ADD CONSTRAINT citation_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: citation citation_performance_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.citation
    ADD CONSTRAINT citation_performance_id_fkey FOREIGN KEY (performance_id) REFERENCES _jazzcanon.performance(id) ON DELETE CASCADE;


--
-- Name: citation citation_production_credit_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.citation
    ADD CONSTRAINT citation_production_credit_id_fkey FOREIGN KEY (production_credit_id) REFERENCES _jazzcanon.production_credit(id) ON DELETE CASCADE;


--
-- Name: citation citation_source_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.citation
    ADD CONSTRAINT citation_source_id_fkey FOREIGN KEY (source_id) REFERENCES _jazzcanon.source(id) ON DELETE CASCADE;


--
-- Name: citation citation_track_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.citation
    ADD CONSTRAINT citation_track_id_fkey FOREIGN KEY (track_id) REFERENCES _jazzcanon.track(id) ON DELETE CASCADE;


--
-- Name: performance performance_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance
    ADD CONSTRAINT performance_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: performance performance_instrument_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance
    ADD CONSTRAINT performance_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES _jazzcanon.instrument(id);


--
-- Name: performance performance_person_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance
    ADD CONSTRAINT performance_person_id_fkey FOREIGN KEY (person_id) REFERENCES _jazzcanon.person(id) ON DELETE CASCADE;


--
-- Name: performance_session performance_session_performance_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance_session
    ADD CONSTRAINT performance_session_performance_id_fkey FOREIGN KEY (performance_id) REFERENCES _jazzcanon.performance(id) ON DELETE CASCADE;


--
-- Name: performance_session performance_session_session_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance_session
    ADD CONSTRAINT performance_session_session_id_fkey FOREIGN KEY (session_id) REFERENCES _jazzcanon.session(id) ON DELETE CASCADE;


--
-- Name: performance_track performance_track_performance_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance_track
    ADD CONSTRAINT performance_track_performance_id_fkey FOREIGN KEY (performance_id) REFERENCES _jazzcanon.performance(id) ON DELETE CASCADE;


--
-- Name: performance_track performance_track_track_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.performance_track
    ADD CONSTRAINT performance_track_track_id_fkey FOREIGN KEY (track_id) REFERENCES _jazzcanon.track(id) ON DELETE CASCADE;


--
-- Name: person_name_variant person_name_variant_person_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.person_name_variant
    ADD CONSTRAINT person_name_variant_person_id_fkey FOREIGN KEY (person_id) REFERENCES _jazzcanon.person(id) ON DELETE CASCADE;


--
-- Name: production_credit production_credit_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.production_credit
    ADD CONSTRAINT production_credit_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: production_credit production_credit_person_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.production_credit
    ADD CONSTRAINT production_credit_person_id_fkey FOREIGN KEY (person_id) REFERENCES _jazzcanon.person(id) ON DELETE CASCADE;


--
-- Name: production_credit production_credit_session_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.production_credit
    ADD CONSTRAINT production_credit_session_id_fkey FOREIGN KEY (session_id) REFERENCES _jazzcanon.session(id) ON DELETE SET NULL;


--
-- Name: session session_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.session
    ADD CONSTRAINT session_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: session session_studio_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.session
    ADD CONSTRAINT session_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES _jazzcanon.studio(id);


--
-- Name: track track_album_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track
    ADD CONSTRAINT track_album_id_fkey FOREIGN KEY (album_id) REFERENCES _jazzcanon.album(id) ON DELETE CASCADE;


--
-- Name: track_composer track_composer_person_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track_composer
    ADD CONSTRAINT track_composer_person_id_fkey FOREIGN KEY (person_id) REFERENCES _jazzcanon.person(id) ON DELETE CASCADE;


--
-- Name: track_composer track_composer_track_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track_composer
    ADD CONSTRAINT track_composer_track_id_fkey FOREIGN KEY (track_id) REFERENCES _jazzcanon.track(id) ON DELETE CASCADE;


--
-- Name: track track_session_id_fkey; Type: FK CONSTRAINT; Schema: _jazzcanon; Owner: -
--

ALTER TABLE ONLY _jazzcanon.track
    ADD CONSTRAINT track_session_id_fkey FOREIGN KEY (session_id) REFERENCES _jazzcanon.session(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict BmVasjlUxPXfTGbUieeYvu79xZNwijtLwqKsHlffmbJOY87T9rgyZC09E9iRayg

