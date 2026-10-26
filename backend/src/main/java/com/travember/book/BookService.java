package com.travember.book;

import com.travember.book.Dtos.BookDetail;
import com.travember.book.Dtos.BookRequest;
import com.travember.book.Dtos.BookSummary;
import com.travember.config.MediaStorage;
import com.travember.destination.DestinationService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class BookService {

    /**
     * The shelf view of books: counts, and the first photo in book order (chapters by start date, pages by
     * visit date) as the fallback cover. Plain SQL because it's one query for the whole shelf.
     */
    private static final String SUMMARY_SQL = """
            select b.id, b.owner_id, b.title, b.description, b.author_name, b.cover_url,
                   (select count(*) from destinations d where d.book_id = b.id) as chapter_count,
                   (select count(*) from places p join destinations d on d.id = p.destination_id
                     where d.book_id = b.id) as page_count,
                   (select m.url from destinations d
                      join places p on p.destination_id = d.id
                      join place_media m on m.place_id = p.id
                     where d.book_id = b.id and m.kind = 'image'
                     order by d.start_date, d.created_at, p.visited_on, p.created_at, m.position
                     limit 1) as first_photo
            from books b
            """;

    /** Matches a book by its title, description or author, or by any of its chapters, countries or places. */
    private static final String MATCHES = """
            (b.title ilike :pattern or b.description ilike :pattern or b.author_name ilike :pattern
             or exists (select 1 from destinations d left join places p on p.destination_id = d.id
                         where d.book_id = b.id
                           and (d.title ilike :pattern or d.country ilike :pattern or p.name ilike :pattern)))
            """;

    private static final int SHELF_LIMIT = 200;

    private final BookRepository books;
    private final DestinationService chapters;
    private final MediaStorage media;
    private final JdbcClient jdbc;

    public BookService(BookRepository books, DestinationService chapters, MediaStorage media, JdbcClient jdbc) {
        this.books = books;
        this.chapters = chapters;
        this.media = media;
        this.jdbc = jdbc;
    }

    /**
     * Newest books first. Every filter is optional: `query` keeps the books that match it, `ownerId` keeps
     * one author's books, and `excludeOwnerId` drops one author's (the signed-in reader's own, on the home page).
     */
    @Transactional(readOnly = true)
    public List<BookSummary> search(String query, UUID ownerId, UUID excludeOwnerId) {
        var where = new ArrayList<String>();
        var params = new HashMap<String, Object>();
        if (query != null && !query.isBlank()) {
            where.add(MATCHES);
            // Escape LIKE's wildcards so a search for "100%" means the text, not "100 followed by anything".
            params.put("pattern", "%" + query.trim().replaceAll("([\\\\%_])", "\\\\$1") + "%");
        }
        if (ownerId != null) {
            where.add("b.owner_id = :ownerId");
            params.put("ownerId", ownerId);
        }
        if (excludeOwnerId != null) {
            where.add("b.owner_id <> :excludeOwnerId");
            params.put("excludeOwnerId", excludeOwnerId);
        }
        var sql = SUMMARY_SQL + (where.isEmpty() ? "" : " where " + String.join(" and ", where))
                + " order by b.created_at desc limit " + SHELF_LIMIT;
        return jdbc.sql(sql).params(params).query(BookService::summary).list();
    }

    @Transactional(readOnly = true)
    public BookDetail get(UUID id, UUID viewerId) {
        return BookDetail.from(summary(id), chapters.listByBook(id, viewerId));
    }

    public BookSummary create(UUID userId, String authorName, BookRequest req) {
        var b = new Book(userId);
        apply(b, req, authorName);
        return summary(books.saveAndFlush(b).getId());
    }

    public BookSummary update(UUID userId, String authorName, UUID id, BookRequest req) {
        var b = findOwnedBook(userId, id);
        apply(b, req, authorName);
        books.flush();
        return summary(id);
    }

    /** The database cascades the delete to the book's chapters, pages, likes and comments. */
    public void delete(UUID userId, UUID id) {
        books.delete(findOwnedBook(userId, id));
    }

    private BookSummary summary(UUID id) {
        return jdbc.sql(SUMMARY_SQL + " where b.id = :id")
                .param("id", id)
                .query(BookService::summary)
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
    }

    private static BookSummary summary(ResultSet rs, int row) throws SQLException {
        var custom = rs.getString("cover_url");
        return new BookSummary(rs.getObject("id", UUID.class), rs.getObject("owner_id", UUID.class),
                rs.getString("title"), rs.getString("description"), rs.getString("author_name"),
                custom != null ? custom : rs.getString("first_photo"), custom,
                rs.getLong("chapter_count"), rs.getLong("page_count"));
    }

    private Book findOwnedBook(UUID userId, UUID id) {
        var b = books.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
        if (!b.getOwnerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author of this book can edit it");
        }
        return b;
    }

    private void apply(Book b, BookRequest req, String authorName) {
        var cover = blankToNull(req.coverUrl());
        if (cover != null && !media.isOwnUpload(b.getOwnerId(), cover)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload the cover from the book form");
        }
        b.setTitle(req.title().trim());
        b.setDescription(blankToNull(req.description()));
        b.setCoverUrl(cover);
        b.setAuthorName(authorName);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
