import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Book } from '../api'

/** Cloth colours for books without a photo, picked from the book's id so each keeps its colour. */
const CLOTHS = ['#7b2f2f', '#2f4a6b', '#3d5a3a', '#6e4a28', '#4b3a6b', '#28595a', '#5a2f4f']

function cloth(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return CLOTHS[Math.abs(h) % CLOTHS.length]
}

/**
 * A hardback seen from the front, with its page block showing. With a cover photo the photo sits in a
 * light board frame; without one it's a cloth binding with the title and author stamped on.
 */
export function BookCover({ book, size = 'md' }: {
  book: Pick<Book, 'id' | 'title' | 'authorName' | 'coverUrl'>
  size?: 'md' | 'lg'
}) {
  return (
    <div className={`book3d book3d--${size}`}>
      {book.coverUrl ? (
        <div className="book3d-cover book3d-cover--photo">
          <img src={book.coverUrl} alt="" loading="lazy" />
        </div>
      ) : (
        <div className="book3d-cover book3d-cover--cloth" style={{ '--cloth': cloth(book.id) } as CSSProperties}>
          <span className="book3d-title">{book.title}</span>
          <span className="book3d-rule" aria-hidden="true" />
          <span className="book3d-author">{book.authorName}</span>
        </div>
      )}
    </div>
  )
}

/** Books standing on a shelf, each with its title and author underneath. */
export function BookShelf({ books }: { books: Book[] }) {
  return (
    <ul className="shelf">
      {books.map((b) => (
        <li key={b.id}>
          <Link to={`/books/${b.id}`} className="shelf-book">
            <BookCover book={b} />
            <span className="shelf-title">{b.title}</span>
            <span className="shelf-author">{b.authorName}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
