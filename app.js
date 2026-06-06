import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const TMDB_API_KEY = "e24be1ac2a69f6e039ecce8243dd0dd3"; // PASTE TMDB KEY HERE

// --- DOM ELEMENTS ---
const searchInput = document.getElementById('movie-search');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const movieList = document.getElementById('movie-list');
const sortSelect = document.getElementById('sort-select');
const modal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');

let libraryData = []; // This will hold all movies + reviews in memory!

// --- 1. TMDB SEARCH & SAVE (Unchanged) ---
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    resultsContainer.innerHTML = ''; 

    data.results.forEach(movie => {
        const div = document.createElement('div');
        div.innerHTML = `<h3>${movie.title}</h3> <button id="add-${movie.id}">Add</button><hr>`;
        resultsContainer.appendChild(div);
        
        document.getElementById(`add-${movie.id}`).addEventListener('click', async () => {
            await setDoc(doc(db, "movies", movie.id.toString()), {
                title: movie.title,
                release_year: movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null,
                poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                metadata: JSON.stringify(movie)
            });
            alert(`${movie.title} added!`);
            loadLibrary(); // Refresh the list
        });
    });
});

// --- 2. LOAD & CALCULATE DATA ---
async function loadLibrary() {
    libraryData = [];
    
    // Fetch all reviews first to calculate math
    const reviewSnap = await getDocs(collection(db, "reviews"));
    const allReviews = {};
    reviewSnap.forEach(doc => {
        const r = doc.data();
        if(!allReviews[r.movie_id]) allReviews[r.movie_id] = [];
        allReviews[r.movie_id].push(r);
    });

    // Fetch movies and attach their math
    const movieSnap = await getDocs(collection(db, "movies"));
    movieSnap.forEach(doc => {
        const movie = doc.data();
        movie.id = doc.id;
        movie.reviews = allReviews[movie.id] || [];
        
        // Calculate Average Rating
        let sum = 0;
        movie.reviews.forEach(r => sum += r.rating);
        movie.avgRating = movie.reviews.length > 0 ? (sum / movie.reviews.length).toFixed(1) : 0;
        
        libraryData.push(movie);
    });

    renderList(); // Draw it on screen
}

// --- 3. RENDER THE LIST & SORTING ---
function renderList() {
    movieList.innerHTML = '';
    const sortBy = sortSelect.value;

    // Sort the array in memory instantly
    libraryData.sort((a, b) => {
        if (sortBy === 'name_asc') return a.title.localeCompare(b.title);
        if (sortBy === 'name_desc') return b.title.localeCompare(a.title);
        if (sortBy === 'rating_desc') return b.avgRating - a.avgRating;
        if (sortBy === 'year_desc') return b.release_year - a.release_year;
    });

    // Draw the rows
    libraryData.forEach(movie => {
        const row = document.createElement('div');
        row.className = 'movie-row';
        row.innerHTML = `
            <div>
                <span class="row-title">${movie.title}</span> 
                <span class="row-year">(${movie.release_year})</span>
            </div>
            <div class="row-rating">⭐ ${movie.avgRating > 0 ? movie.avgRating : 'Unrated'}</div>
        `;
        
        // When a row is clicked, open the Modal
        row.addEventListener('click', () => openModal(movie));
        movieList.appendChild(row);
    });
}

sortSelect.addEventListener('change', renderList); // Re-sort when dropdown changes

// --- 4. THE DETAILED MODAL ---
function openModal(movie) {
    let reviewHTML = movie.reviews.length === 0 ? '<p>No reviews yet.</p>' : '';
    movie.reviews.forEach(r => {
        reviewHTML += `<p><strong>${r.reviewer_name} (${'🍿'.repeat(r.rating)}):</strong> ${r.review_text}</p>`;
    });

    modalBody.innerHTML = `
        <div class="modal-layout">
            <img src="${movie.poster_url}" class="modal-poster">
            <div>
                <h2>${movie.title} (${movie.release_year})</h2>
                <p><strong>Average Rating:</strong> ${movie.avgRating > 0 ? movie.avgRating + '/5' : 'None yet'}</p>
                <div style="max-height: 150px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                    ${reviewHTML}
                </div>
            </div>
        </div>
        <hr>
        <div class="review-form">
            <h4>Add a Review</h4>
            <div class="popcorn-rating" id="modal-popcorns">
                <span class="popcorn" data-value="1">🍿</span>
                <span class="popcorn" data-value="2">🍿</span>
                <span class="popcorn" data-value="3">🍿</span>
                <span class="popcorn" data-value="4">🍿</span>
                <span class="popcorn" data-value="5">🍿</span>
            </div>
            <input type="hidden" id="modal-rating" value="0">
            <input type="text" id="modal-text" placeholder="Write a review...">
            <button id="modal-submit">Submit</button>
        </div>
    `;

    modal.classList.remove('hidden');

    // Attach Popcorn Logic inside the Modal
    const popcorns = document.querySelectorAll('#modal-popcorns .popcorn');
    const ratingInput = document.getElementById('modal-rating');
    popcorns.forEach(pop => {
        pop.addEventListener('mouseover', function() {
            const val = this.getAttribute('data-value');
            popcorns.forEach(p => p.getAttribute('data-value') <= val ? p.classList.add('hover') : p.classList.remove('hover'));
        });
        pop.addEventListener('mouseout', () => popcorns.forEach(p => p.classList.remove('hover')));
        pop.addEventListener('click', function() {
            const val = this.getAttribute('data-value');
            ratingInput.value = val;
            popcorns.forEach(p => p.getAttribute('data-value') <= val ? p.classList.add('selected') : p.classList.remove('selected'));
        });
    });

    // Attach Submit Logic
    document.getElementById('modal-submit').addEventListener('click', async () => {
        const ratingVal = ratingInput.value;
        const textVal = document.getElementById('modal-text').value;
        if (ratingVal > 0 && textVal) {
            await addDoc(collection(db, "reviews"), {
                movie_id: movie.id, reviewer_name: "Me", rating: Number(ratingVal), review_text: textVal, timestamp: new Date()
            });
            modal.classList.add('hidden'); // Close modal
            loadLibrary(); // Refresh everything to update averages!
        }
    });
}

closeModal.addEventListener('click', () => modal.classList.add('hidden'));

// Start app
loadLibrary();