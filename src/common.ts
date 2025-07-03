/**
 * Copyright 2023–2025 Waii, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const WAII_TRIAL_USER = 'waii-trial-user';
const WAII_TRAIL_API_USER = 'waii-trial-api-user';
const WAII_USER = 'waii-user';
const WAII_API_USER = 'waii-api-user';
const WAII_ADMIN_USER = 'waii-admin-user';
const WAII_ORG_ADMIN_USER = 'waii-org-admin-user';
const WAII_SUPER_ADMIN_USER = 'waii-super-admin-user';

const READ_SEMANTIC_CONTEXT = 'read:semantic-context';
const READ_LIKED_QUERIES = 'read:liked-queries';
const READ_DATABASES = 'read:databases';
const WRITE_LIKED_QUERIES = 'write:liked-queries';
const WRITE_SEMANTIC_CONTEXT = 'write:semantic-context';
const WRITE_DATABASES = 'write:databases';
const PUSH_DATABASES = 'push:databases';
const WRITE_SIMILARITY_SEARCH_INDEX = 'write:similarity-search-index';
const READ_SIMILARITY_SEARCH_INDEX = 'read:similarity-search-index';
const USAGE_API = 'usage:api';
const WRITE_ACCESS_KEY = 'write:access_key';
const PUBLISH_SEMANTIC_CONTEXT = 'publish:semantic-context';
const PUBLISH_LIKED_QUERIES = 'publish:liked-queries';
const PUBLISH_TABLE_ACCESS_RULES = 'publish:access-rules';
const READ_USER = 'read:user';
const READ_TENANT = 'read:tenant';
const READ_ORG = 'read:org';
const WRITE_USER = 'write:user';
const WRITE_TENANT = 'write:tenant';
const WRITE_ORG = 'write:org';
const USAGE_IMPERSONATION = 'usage:impersonation';
const READ_USAGE_REPORT = 'read:usage-report';

export const WaiiRoles = {
    WAII_ADMIN_USER,
    WAII_API_USER,
    WAII_ORG_ADMIN_USER,
    WAII_SUPER_ADMIN_USER,
    WAII_USER,
    WAII_TRAIL_API_USER,
    WAII_TRIAL_USER
};

export const WaiiPermissions = {
    READ_SEMANTIC_CONTEXT,
    READ_LIKED_QUERIES,
    READ_DATABASES,
    WRITE_LIKED_QUERIES,
    WRITE_SEMANTIC_CONTEXT,
    WRITE_DATABASES,
    PUSH_DATABASES,
    WRITE_SIMILARITY_SEARCH_INDEX,
    READ_SIMILARITY_SEARCH_INDEX,
    USAGE_API,
    WRITE_ACCESS_KEY,
    PUBLISH_SEMANTIC_CONTEXT,
    PUBLISH_LIKED_QUERIES,
    PUBLISH_TABLE_ACCESS_RULES,
    READ_USER,
    READ_TENANT,
    READ_ORG,
    WRITE_USER,
    WRITE_TENANT,
    WRITE_ORG,
    USAGE_IMPERSONATION,
    READ_USAGE_REPORT
};

const ROLE_RANKS: {[key: string]: number} = {};

ROLE_RANKS[WAII_TRIAL_USER] = 1;
ROLE_RANKS[WAII_TRAIL_API_USER] = 1;
ROLE_RANKS[WAII_USER] = 2;
ROLE_RANKS[WAII_API_USER] = 3;
ROLE_RANKS[WAII_ADMIN_USER] = 4;
ROLE_RANKS[WAII_ORG_ADMIN_USER] = 5;
ROLE_RANKS[WAII_SUPER_ADMIN_USER] = 6;

export { ROLE_RANKS };
