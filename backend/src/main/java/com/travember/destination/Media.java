package com.travember.destination;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** A photo or video on a page. The file is in the page-media Storage bucket; this is its public URL. */
@Embeddable
public class Media {

    /** "image" or "video". */
    @Column(nullable = false)
    private String kind;

    @Column(nullable = false)
    private String url;

    protected Media() {
    }

    public Media(String kind, String url) {
        this.kind = kind;
        this.url = url;
    }

    public String getKind() { return kind; }
    public String getUrl() { return url; }
}
