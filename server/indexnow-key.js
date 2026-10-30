// The site's IndexNow key (indexnow.js). Not a secret: IndexNow reads it back
// from /<key>.txt on this site to check a request came from the site's owner
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "91b02c85a1f454796b1656c6f75d6e59";
