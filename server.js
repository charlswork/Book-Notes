const express = require("express");
const app = express();
const { Client } = require("pg");
const path = require("path");
const axios = require("axios"); // To make API requests to Open Library
const bodyParser = require("body-parser");

app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "book_notes",
  password: "2002356_Charles",
  port: 5432,
});

client
  .connect()
  .then(() => console.log("Connected to the database"))
  .catch((err) => console.error("Error connecting to the database:", err));

// Function to fetch book details from Open Library API
const fetchBooksFromOpenLibrary = async (query = "JavaScript") => {
  try {
    const response = await axios.get(
      `https://openlibrary.org/search.json?q=${query}&limit=10`
    );

    // Return essential book details
    return response.data.docs.map((book) => ({
      title: book.title,
      author: book.author_name ? book.author_name.join(", ") : "Unknown",
      coverUrl: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        : null,
    }));
  } catch (error) {
    console.error("Error fetching books:", error.message);
    return [];
  }
};

// Route to fetch and display all books, adding new ones from API if needed
app.get("/", async (req, res) => {
  try {
    const books = await fetchBooksFromOpenLibrary("JavaScript");

    // Insert only new books
    const insertPromises = books.map(async (book) => {
      const checkQuery = `SELECT * FROM books WHERE title = $1 AND author = $2`;
      const existingBook = await client.query(checkQuery, [
        book.title,
        book.author,
      ]);

      if (existingBook.rows.length === 0) {
        const insertQuery = `
          INSERT INTO books (title, author, cover_url, created_at, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        await client.query(insertQuery, [
          book.title,
          book.author,
          book.coverUrl,
        ]);
      }
    });

    await Promise.all(insertPromises);

    const dbBooks = await client.query("SELECT * FROM books");
    res.render("book", { books: dbBooks.rows });
  } catch (error) {
    console.error("Error in / route:", error.message);
    res.status(500).send("Error fetching books");
  }
});

// Route to mark a book as read
app.post("/markAsRead", async (req, res) => {
  const { bookId } = req.body;

  try {
    if (!bookId) throw new Error("Book ID is missing");

    const result = await client.query(
      `UPDATE books SET read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookId]
    );

    if (result.rowCount === 0)
      throw new Error("Book not found or no changes made");

    res.redirect("/");
  } catch (error) {
    console.error("Error marking book as read:", error.message);
    res.status(500).send("Error marking book as read");
  }
});

// Route to display all books
app.get("/allBooks", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM books");
    res.render("book", { books: result.rows });
  } catch (error) {
    console.error("Error fetching all books:", error.message);
    res.status(500).send("Error fetching books");
  }
});

// Route to display only read books
// app.get("/readBooks", async (req, res) => {
//   try {
//     const result = await client.query("SELECT * FROM books WHERE read = TRUE");
//     res.render("readBooks", { books: result.rows });
//   } catch (error) {
//     console.error("Error fetching read books:", error.message);
//     res.status(500).send("Error fetching read books");
//   }
// });

// Route to display only read books, sorting primarily by recency, then by rating
app.get("/readBooks", async (req, res) => {
  try {
    // Query that orders by recency first, then by rating (both in descending order)
    const query = `
      SELECT * FROM books WHERE read = TRUE
      ORDER BY updated_at DESC, created_at DESC, rating DESC
    `;
    const result = await client.query(query);

    // Render the readBooks view with sorted book data
    res.render("readBooks", { books: result.rows });
  } catch (error) {
    console.error("Error fetching read books:", error.message);
    res.status(500).send("Error fetching read books");
  }
});

// app.get("/readBooks", async (req, res) => {
//   // Set default sorting values
//   const sortBy = req.query.sortBy || "created_at"; // default to recency
//   const order = req.query.order || "DESC"; // default to descending (newest/highest rating at top)

//   // Validate inputs for security and prevent SQL injection
//   const validSortBy = ["created_at", "rating"];
//   const validOrder = ["ASC", "DESC"];

//   if (!validSortBy.includes(sortBy) || !validOrder.includes(order)) {
//     return res.status(400).send("Invalid sorting parameters");
//   }

//   try {
//     // SQL query with dynamic ordering based on sortBy and order
//     const query = `SELECT * FROM books WHERE read = TRUE ORDER BY ${sortBy} ${order}`;
//     const result = await client.query(query);

//     // Render the readBooks view, passing sorted books data
//     res.render("readBooks", { books: result.rows });
//   } catch (error) {
//     console.error("Error fetching read books:", error.message);
//     res.status(500).send("Error fetching read books");
//   }
// });

// Route to fetch and display details of a specific book

app.get("/book/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query("SELECT * FROM books WHERE id = $1", [
      id,
    ]);
    const book = result.rows[0];

    if (!book) return res.status(404).send("Book not found");

    res.render("bookDetail", { book });
  } catch (error) {
    console.error("Error fetching book details:", error.message);
    res.status(500).send("Error fetching book details");
  }
});

// Route to mark a book as read and show its details
app.get("/book/read/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await client.query(
      `UPDATE books SET read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    const result = await client.query("SELECT * FROM books WHERE id = $1", [
      id,
    ]);
    const book = result.rows[0];

    if (!book) return res.status(404).send("Book not found");

    res.render("bookDetail", { book });
  } catch (error) {
    console.error(
      "Error marking book as read and displaying details:",
      error.message
    );
    res.status(500).send("Error displaying book details");
  }
});

app.post("/book/:id/updateReview", async (req, res) => {
  const { id } = req.params; // Book ID
  const { review, rating } = req.body;

  try {
    await client.query(
      `UPDATE books SET review = $1, rating = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [review, rating, id]
    );
    res.redirect(`/book/read/${id}`);
  } catch (error) {
    console.error("Error updating review:", error.message);
    res.status(500).send("Error updating review");
  }
});

app.post("/book/:id/addNote", async (req, res) => {
  const { id } = req.params; // Book ID
  const { note } = req.body;

  try {
    await client.query(
      `UPDATE books SET note = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [note, id]
    );
    res.redirect(`/book/read/${id}`);
  } catch (error) {
    console.error("Error adding note:", error.message);
    res.status(500).send("Error adding note");
  }
});

app.post("/book/:id/removeRead", async (req, res) => {
  const { id } = req.params;

  try {
    // Ensure `read` is updated to false (unread)
    await client.query(
      `UPDATE books SET read = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Redirect the user back to the general book listing page
    res.redirect("/readBooks"); // Change this line to send the user to the book.ejs page
  } catch (error) {
    console.error("Error removing book from read list:", error.message);
    res.status(500).send("Error removing book from read list");
  }
});

app.get("/book/details/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query("SELECT * FROM books WHERE id = $1", [
      id,
    ]);

    if (result.rows.length > 0) {
      res.render("bookDetail", { book: result.rows[0] }); // Ensure you have a bookDetails.ejs file
    } else {
      res.status(404).send("Book not found");
    }
  } catch (error) {
    console.error("Error fetching book details:", error);
    res.status(500).send("Error fetching book details");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
