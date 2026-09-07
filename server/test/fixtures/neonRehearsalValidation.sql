-- Synthetic validation ONLY on the schema-only Neon rehearsal branch.
-- All row writes are rolled back. Sequence allocation is confined to this disposable branch.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = public;
DO $guard$ DECLARE t record; n bigint; BEGIN
IF current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-autumn-mode-aikak52t'
 OR current_database() <> 'neondb' OR current_setting('server_version_num')::int / 10000 <> 17
 THEN RAISE EXCEPTION 'Wrong rehearsal target'; END IF;
IF (SELECT count(*) FROM pg_tables WHERE schemaname='public') <> 70
 OR (SELECT count(*) FROM carearound_release.schema_changes) <> 5
 THEN RAISE EXCEPTION 'Rehearsal upgrade incomplete'; END IF;
FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
 EXECUTE format('SELECT count(*) FROM public.%I',t.tablename) INTO n;
 IF n <> 0 THEN RAISE EXCEPTION 'Rehearsal is not empty'; END IF;
END LOOP;
END $guard$;
DO $validation$ DECLARE c record; rejected boolean; actual_state text; cases_passed integer := 0; BEGIN
INSERT INTO users (id,username,email,password_hash,name,role) VALUES
 (1,'rehearsal','rehearsal@example.test','synthetic-only','Synthetic owner','standard'),
 (2,'REHEARSAL','REHEARSAL@example.test','synthetic-only','Synthetic staff','admin'),
 (3,'partner-fixture','partner@example.test','synthetic-only','Synthetic partner','partner');
INSERT INTO hard_assets (id,name,lat,lng,address,partner_id) VALUES
 (1,'Synthetic place',1.3,103.8,'Synthetic address',NULL),(3,'Synthetic partner place',1.3,103.8,'Synthetic address',3);
INSERT INTO soft_assets (id,name,calendar_enabled,calendar_revision,partner_id) VALUES
 (1,'Synthetic offering',true,1,NULL),(3,'Synthetic partner offering',false,0,3);
INSERT INTO user_favorites (id,user_id,resource_type,resource_id) VALUES (1,1,'soft',1);
INSERT INTO my_maps (id,user_id,name) VALUES (1,1,'Synthetic private map');
INSERT INTO my_map_assets (map_id,resource_type,resource_id) VALUES (1,'soft',1);
INSERT INTO user_calendar_items (user_id,item_type,soft_asset_id,title,starts_at,source_revision)
 VALUES (1,'planned_session',1,'Synthetic existing plan','2026-09-10T01:00:00Z',1);
INSERT INTO user_calendar_schedule_states (user_id,soft_asset_id,last_seen_revision) VALUES (1,1,1);
INSERT INTO support_conversations (id,owner_user_id,title) VALUES ('conversation',1,'Synthetic report');
INSERT INTO support_conversations (id,guest_token_hash,guest_expires_at,title)
 VALUES ('guest',repeat('b',64),now()+interval '1 day','Synthetic guest');
INSERT INTO support_fix_proposals (id,conversation_id,source_revision,target,summary,test_evidence,proposed_by_user_id,approved_by_user_id)
 VALUES ('proposal','conversation',repeat('a',40),'client','Synthetic proposal','Synthetic test',2,2);
INSERT INTO support_messages (conversation_id,sequence,request_key,author_kind,author_user_id,body)
 VALUES ('conversation',1,'synthetic-request','user',1,'Synthetic message');
INSERT INTO guide_conversations (id,owner_user_id,slot,title,inputs,last_request_id)
 VALUES ('guide',1,0,'Synthetic guide','[{"question":"Synthetic question"}]','synthetic-request');
INSERT INTO notification_resource_jobs (user_id) VALUES (1);
INSERT INTO notification_resource_watches (id,favorite_id,baseline) VALUES ('watch',1,'{}');
INSERT INTO user_notifications (id,watch_id,categories,changed_fields) VALUES ('notice','watch','["calendar"]','["schedule"]');
INSERT INTO saved_searches (id,user_id,slot,query,resource_type) VALUES ('search',1,1,'synthetic keywords','all');
INSERT INTO saved_search_matches (search_id,match_key) VALUES ('search',repeat('a',64));
INSERT INTO saved_search_digests (search_id,notice_id,search_revision,baseline_preference) VALUES ('search','digest',1,'{}');
FOR c IN SELECT * FROM (VALUES
 ('UPDATE support_conversations SET owner_user_id=NULL','23514'),
 ('UPDATE support_conversations SET status=''bad''','23514'),
 ('UPDATE support_conversations SET revision=0','23514'),
 ('UPDATE support_fix_proposals SET target=''bad''','23514'),
 ('UPDATE support_fix_proposals SET source_revision=''bad''','23514'),
 ('UPDATE support_fix_proposals SET verified_at=now()','23514'),
 ('UPDATE support_messages SET author_kind=''bad''','23514'),
 ('UPDATE support_messages SET sequence=0','23514'),
 ('UPDATE guide_conversations SET slot=20','23514'),
 ('UPDATE guide_conversations SET revision=0','23514'),
 ('UPDATE guide_conversations SET inputs=''[]''','23514'),
 ('UPDATE notification_resource_jobs SET favorite_cursor=-1','23514'),
 ('UPDATE notification_resource_jobs SET lease_id=''unpaired''','23514'),
 ('UPDATE notification_resource_watches SET baseline=''[]''','23514'),
 ('UPDATE notification_resource_watches SET control_revision=0','23514'),
 ('UPDATE user_notifications SET categories=''["general"]''','23514'),
 ('UPDATE user_notifications SET changed_fields=''["privateNote"]''','23514'),
 ('UPDATE user_notifications SET read_revision=2','23514'),
 ('UPDATE saved_searches SET slot=11','23514'),
 ('UPDATE saved_searches SET resource_type=''bad''','23514'),
 ('UPDATE saved_searches SET scan_page=0','23514'),
 ('UPDATE saved_searches SET lease_id=''unpaired''','23514'),
 ('UPDATE saved_searches SET baseline_preference=''[]''','23514'),
 ('UPDATE saved_searches SET scan_cursor=''[]''','23514'),
 ('UPDATE saved_search_matches SET match_key=''bad''','23514'),
 ('UPDATE saved_search_digests SET read_revision=2','23514'),
 ('UPDATE saved_search_digests SET baseline_preference=''[]''','23514'),
 ('UPDATE support_conversations SET owner_user_id=999 WHERE id=''conversation''','23503'),
 ('UPDATE support_fix_proposals SET conversation_id=''missing''','23503'),
 ('UPDATE support_fix_proposals SET proposed_by_user_id=999','23503'),
 ('UPDATE support_fix_proposals SET approved_by_user_id=999','23503'),
 ('UPDATE support_messages SET conversation_id=''missing''','23503'),
 ('UPDATE support_messages SET author_user_id=999','23503'),
 ('UPDATE guide_conversations SET owner_user_id=999','23503'),
 ('UPDATE notification_resource_jobs SET user_id=999','23503'),
 ('UPDATE notification_resource_watches SET favorite_id=999','23503'),
 ('UPDATE user_notifications SET watch_id=''missing''','23503'),
 ('UPDATE saved_searches SET user_id=999','23503'),
 ('UPDATE saved_search_matches SET search_id=''missing''','23503'),
 ('UPDATE saved_search_digests SET search_id=''missing''','23503'),
 ('INSERT INTO support_messages (conversation_id,sequence,request_key,author_kind,body) VALUES (''conversation'',2,''synthetic-request'',''system'',''Synthetic duplicate'')','23505'),
 ('INSERT INTO guide_conversations (id,owner_user_id,slot,title,inputs,last_request_id) VALUES (''guide-other'',1,0,''Synthetic duplicate'',''[{}]'',''other'')','23505'),
 ('INSERT INTO notification_resource_watches (id,favorite_id,baseline) VALUES (''watch-other'',1,''{}'')','23505'),
 ('INSERT INTO user_notifications (id,watch_id,categories,changed_fields) VALUES (''notice-other'',''watch'',''["calendar"]'',''["schedule"]'')','23505'),
 ('INSERT INTO saved_searches (id,user_id,slot,query,resource_type) VALUES (''search-other'',1,1,''different keywords'',''all'')','23505'),
 ('INSERT INTO saved_searches (id,user_id,slot,query,resource_type) VALUES (''search-other'',1,2,''synthetic keywords'',''all'')','23505'),
 ('INSERT INTO support_conversations (id,guest_token_hash,guest_expires_at,title) VALUES (''guest-other'',repeat(''b'',64),now()+interval ''1 day'',''Synthetic duplicate'')','23505')
) v(statement,expected_state) LOOP
 rejected := false;
 BEGIN
  EXECUTE c.statement;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
  IF actual_state <> c.expected_state THEN RAISE EXCEPTION 'Unexpected constraint SQLSTATE % at case %',actual_state,cases_passed + 1; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Constraint accepted invalid synthetic state'; END IF;
 cases_passed := cases_passed + 1;
END LOOP;
IF cases_passed <> 47 THEN RAISE EXCEPTION 'Incomplete constraint checks'; END IF;
DELETE FROM user_favorites WHERE id=1;
IF EXISTS (SELECT FROM notification_resource_watches) OR EXISTS (SELECT FROM user_notifications)
 OR (SELECT count(*) FROM my_maps) <> 1 OR (SELECT count(*) FROM my_map_assets) <> 1
 OR (SELECT count(*) FROM user_calendar_items) <> 1 OR (SELECT count(*) FROM user_calendar_schedule_states) <> 1
 THEN RAISE EXCEPTION 'Unsave retention/cascade mismatch'; END IF;
DELETE FROM users WHERE id=3;
IF EXISTS (SELECT FROM hard_assets WHERE id=3) OR EXISTS (SELECT FROM soft_assets WHERE id=3)
 THEN RAISE EXCEPTION 'Legacy partner cascade changed'; END IF;
DELETE FROM users WHERE id=2;
IF EXISTS (SELECT FROM support_fix_proposals WHERE proposed_by_user_id IS NOT NULL OR approved_by_user_id IS NOT NULL)
 THEN RAISE EXCEPTION 'Staff SET NULL mismatch'; END IF;
DELETE FROM users WHERE id=1;
IF EXISTS (SELECT FROM support_conversations WHERE owner_user_id IS NOT NULL)
 OR EXISTS (SELECT FROM support_messages) OR EXISTS (SELECT FROM support_fix_proposals)
 OR EXISTS (SELECT FROM guide_conversations) OR EXISTS (SELECT FROM notification_resource_jobs)
 OR EXISTS (SELECT FROM saved_searches) OR EXISTS (SELECT FROM saved_search_matches) OR EXISTS (SELECT FROM saved_search_digests)
 THEN RAISE EXCEPTION 'Owner cleanup mismatch'; END IF;
END $validation$;
SELECT jsonb_build_object('status','synthetic_validation_passed','constraint_cases',47,
 'check_constraints',27,'foreign_keys',13,'unique_indexes',7,
 'unsave_map_calendar_retained',true,'legacy_partner_cascade_retained',true,'staff_set_null_retained',true,'owner_cleanup',true,
 'branch',current_setting('neon.branch_id',true),'role',current_user) AS rehearsal_validation;
ROLLBACK;
DO $cleanup$ DECLARE t record; n bigint; BEGIN
FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
 EXECUTE format('SELECT count(*) FROM public.%I',t.tablename) INTO n;
 IF n <> 0 THEN RAISE EXCEPTION 'Synthetic records survived rollback'; END IF;
END LOOP;
END $cleanup$;
SELECT jsonb_build_object('status','all_public_tables_empty_after_rollback',
 'public_tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),
 'history_rows',(SELECT count(*) FROM carearound_release.schema_changes),
 'branch',current_setting('neon.branch_id',true)) AS rehearsal_cleanup;
