-- Creates the `private` schema used for SECURITY DEFINER helper functions
-- and RLS policy helpers that must never be reachable through the Data API
-- (Design: Database Security Contract, D9; Grant hygiene F6).
--
-- The Data API only exposes the schemas listed under `api.schemas` in
-- supabase/config.toml (`public`, `graphql_public`), so `private` never
-- gets a REST endpoint regardless of grants. The revokes below are
-- defense in depth, not a fix for an actual default grant: Postgres does
-- not auto-grant privileges on a schema it has just created to anyone but
-- the owner. Every migration in this project ends the same way, revoking
-- the defaults on exactly the objects it creates, and this is the first
-- one.
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
