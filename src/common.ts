const WAII_TRIAL_USER = 'waii-trial-user'
const WAII_TRAIL_API_USER = 'waii-trial-api-user'
const WAII_USER = 'waii-user'
const WAII_API_USER = 'waii-api-user'
const WAII_ADMIN_USER = 'waii-admin-user'
const WAII_ORG_ADMIN_USER = 'waii-org-admin-user'
const WAII_SUPER_ADMIN_USER = 'waii-super-admin-user'

export const WaiiRoles = {
    WAII_ADMIN_USER,
    WAII_API_USER,
    WAII_ORG_ADMIN_USER,
    WAII_SUPER_ADMIN_USER,
    WAII_USER,
    WAII_TRAIL_API_USER,
    WAII_TRIAL_USER
}

const ROLE_RANKS: {[key: string]: number} = {}

ROLE_RANKS[WAII_TRIAL_USER] = 1;
ROLE_RANKS[WAII_TRAIL_API_USER] = 1;
ROLE_RANKS[WAII_USER] = 2;
ROLE_RANKS[WAII_API_USER] = 3;
ROLE_RANKS[WAII_ADMIN_USER] = 4;
ROLE_RANKS[WAII_ORG_ADMIN_USER] = 5;
ROLE_RANKS[WAII_SUPER_ADMIN_USER] = 6;

export { ROLE_RANKS }