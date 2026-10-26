package com.travember.config;

import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Photos, videos and book covers are uploaded by the browser straight to the page-media Storage bucket,
 * into a folder named after the uploader. The API stores only their public URLs.
 */
@Component
public class MediaStorage {

    /** Must match the bucket created in supabase/schema.sql. */
    private static final String BUCKET = "page-media";

    private final String publicUrlPrefix;

    public MediaStorage(AppProperties props) {
        this.publicUrlPrefix = props.supabaseUrl().replaceAll("/+$", "") + "/storage/v1/object/public/" + BUCKET + "/";
    }

    /** True if the URL is a file in this user's own folder, so nobody can hotlink arbitrary URLs. */
    public boolean isOwnUpload(UUID userId, String url) {
        return url.startsWith(publicUrlPrefix + userId + "/") && !url.contains("..");
    }
}
