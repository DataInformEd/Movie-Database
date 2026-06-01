// --- 1. FIREBASE SETUP --- //
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWejOD76urF3z2GrUvaBcvsfQ9k1H4xxg",
  authDomain: "movie-tracker-de368.firebaseapp.com",
  projectId: "movie-tracker-de368",
  storageBucket: "movie-tracker-de368.firebasestorage.app",
  messagingSenderId: "113968828988",
  appId: "1:113968828988:web:530779c3fe0346e4c72939"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. TMDB API & DOM ELEMENTS --- //
const TMDB_API_KEY = "e24be1ac2a69f6e039ecce8243dd0dd3"; // PASTE TMDB KEY HERE
const searchInput = document.getElementById('movie-search');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const movieGrid = document.getElementById('movie-grid'); // Declared exactly once!

// --- 3. DATABASE SAVE FUNCTION --- //
async function saveMovieToDB(movie) {
    try {
        const movieRef = doc(db, "movies", movie.id.toString());
        const metadataString = JSON.stringify(movie);
        const releaseYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null;

        await setDoc(movieRef, {
            title: movie.title,
            release_year: releaseYear,
            poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            metadata: metadataString
        });

        console.log(`Success: ${movie.title} was saved!`);
        alert(`${movie.title} added to your tracker!`);
        
        // Reload the library to show the new movie immediately
        loadLibrary();

    } catch (error) {
        console.error("Error saving to database: ", error);
    }
}

// --- 4. SEARCH LOGIC --- //
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;

    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        resultsContainer.innerHTML = ''; 

        data.results.forEach(movie => {
            const movieElement = document.createElement('div');
            const year = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';
            
            movieElement.innerHTML = `
                <h3>${movie.title} (${year})</h3>
                <p>${movie.overview}</p>
            `;

            const addBtn = document.createElement('button');
            addBtn.innerText = 'Add to Database';
            addBtn.addEventListener('click', () => saveMovieToDB(movie));

            movieElement.appendChild(addBtn);
            movieElement.appendChild(document.createElement('hr'));
            resultsContainer.appendChild(movieElement);
        });

    } catch (error) {
        console.error("Error fetching from TMDB:", error);
    }
});

// --- 5. REVIEWS LOGIC --- //
async function loadReviews(movieId, containerElement) {
    try {
        const q = query(collection(db, "reviews"), where("movie_id", "==", movieId));
        const querySnapshot = await getDocs(q);
        
        containerElement.innerHTML = '<h4>Reviews:</h4>';
        
        if (querySnapshot.empty) {
            containerElement.innerHTML += '<p style="color: #8c8d90;">No reviews yet. Grab some popcorn and be the first!</p>';
        } else {
            querySnapshot.forEach((reviewDoc) => {
                const review = reviewDoc.data();
                // Turn the number (e.g., 3) into a string of popcorn emojis (🍿🍿🍿)
                const popcornString = '🍿'.repeat(review.rating);
                containerElement.innerHTML += `<p><strong>${review.reviewer_name} (${popcornString}):</strong> ${review.review_text}</p>`;
            });
        }
    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

async function saveReview(movieId, rating, text) {
    try {
        await addDoc(collection(db, "reviews"), {
            movie_id: movieId,
            reviewer_name: "Me", 
            rating: Number(rating),
            review_text: text,
            timestamp: new Date()
        });
        console.log("Review saved successfully!");
    } catch (error) {
        console.error("Error saving review:", error);
    }
}

// --- 6. LOAD LIBRARY --- //
async function loadLibrary() {
    try {
        movieGrid.innerHTML = '';
        const querySnapshot = await getDocs(collection(db, "movies"));
        
        querySnapshot.forEach((movieDoc) => {
            const movie = movieDoc.data(); 
            const movieId = movieDoc.id; 
            
            const movieCard = document.createElement('div');
            
            movieCard.innerHTML = `
                <img src="${movie.poster_url}" alt="${movie.title}">
                <h3>${movie.title} (${movie.release_year})</h3>
                
                <div id="reviews-container-${movieId}" style="background: rgba(0,0,0,0.2); padding: 10px; margin: 0 15px 10px 15px; border-radius: 6px;">
                </div>
                
                <div class="review-form">
                    <div class="popcorn-rating" id="popcorn-container-${movieId}">
                        <span class="popcorn" data-value="1">🍿</span>
                        <span class="popcorn" data-value="2">🍿</span>
                        <span class="popcorn" data-value="3">🍿</span>
                        <span class="popcorn" data-value="4">🍿</span>
                        <span class="popcorn" data-value="5">🍿</span>
                    </div>
                    <input type="hidden" id="rating-${movieId}" value="0">
                    
                    <input type="text" id="text-${movieId}" placeholder="Write a short review...">
                    <button id="btn-${movieId}">Submit</button>
                </div>
            `;
            
            movieGrid.appendChild(movieCard);

            const reviewsContainer = document.getElementById(`reviews-container-${movieId}`);
            loadReviews(movieId, reviewsContainer);

            // --- POPCORN INTERACTION LOGIC --- //
            const popcorns = document.querySelectorAll(`#popcorn-container-${movieId} .popcorn`);
            const ratingInput = document.getElementById(`rating-${movieId}`);

            popcorns.forEach(pop => {
                // 1. Hover Effect
                pop.addEventListener('mouseover', function() {
                    const val = this.getAttribute('data-value');
                    popcorns.forEach(p => {
                        if (p.getAttribute('data-value') <= val) {
                            p.classList.add('hover');
                        } else {
                            p.classList.remove('hover');
                        }
                    });
                });

                // 2. Remove Hover Effect when mouse leaves
                pop.addEventListener('mouseout', function() {
                    popcorns.forEach(p => p.classList.remove('hover'));
                });

                // 3. Click to Lock in the Rating
                pop.addEventListener('click', function() {
                    const val = this.getAttribute('data-value');
                    ratingInput.value = val; // Save the number to the hidden input
                    
                    popcorns.forEach(p => {
                        if (p.getAttribute('data-value') <= val) {
                            p.classList.add('selected');
                        } else {
                            p.classList.remove('selected');
                        }
                    });
                });
            });

            // --- SUBMIT BUTTON LOGIC --- //
            const submitBtn = document.getElementById(`btn-${movieId}`);
            submitBtn.addEventListener('click', async () => {
                const ratingValue = ratingInput.value; // Grab the hidden number
                const textValue = document.getElementById(`text-${movieId}`).value;
                
                if (ratingValue > 0 && textValue) {
                    await saveReview(movieId, ratingValue, textValue);
                    
                    // Reset the form
                    ratingInput.value = '0';
                    document.getElementById(`text-${movieId}`).value = '';
                    popcorns.forEach(p => p.classList.remove('selected'));
                    
                    loadReviews(movieId, reviewsContainer);
                } else {
                    alert("Please select a popcorn rating and write a review!");
                }
            });
        });

    } catch (error) {
        console.error("Error loading library: ", error);
    }
}

// Start the loop on page load
loadLibrary();