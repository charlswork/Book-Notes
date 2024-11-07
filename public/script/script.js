function markAsRead(bookId, element) {
  // Make an AJAX request to mark the book as read
  fetch("/markAsRead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookId: bookId }), // Send JSON with bookId
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        // Update the status text and style to "Read"
        element.querySelector(".status").textContent = "Status: Read";
        element.classList.add("bg-green-100");
        element.classList.add("border-green-500");
        element.classList.remove("cursor-pointer");
      }
    })
    .catch((error) => {
      console.error("Error marking book as read:", error);
    });
}

document
  .getElementById("edit-review-btn")
  .addEventListener("click", function () {
    document.getElementById("review-display").style.display = "none";
    document.getElementById("review-edit-form").style.display = "block";
    this.style.display = "none"; // Hide edit button while editing
  });

// Note Edit Button Toggle
document.getElementById("edit-note-btn").addEventListener("click", function () {
  document.getElementById("note-display").style.display = "none";
  document.getElementById("note-edit-form").style.display = "block";
  this.style.display = "none"; // Hide edit button while editing
});
