interface Env {
	// CORS Proxy configuration
	ALLOWED_SITE?: string;
	ALLOWED_TARGET?: string;
	BLACKLIST_SITE?: string;
	REMOVE_HEADERS?: string;
	REQUIRE_HEADER?: string;
	DEV_PARAM?: string;
}
