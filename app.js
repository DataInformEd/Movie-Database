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

// --- TMDB GENRE MAP ---
const tmdbGenres = {28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",18:"Drama",10751:"Family",14:"Fantasy",36:"History",27:"Horror",10402:"Music",9648:"Mystery",10749:"Romance",878:"Sci-Fi",10770:"TV Movie",53:"Thriller",10752:"War",37:"Western"};

// --- DOM ELEMENTS ---
const exploreView = document.getElementById('explore-view');
const addView = document.getElementById('add-view');
const navExplore = document.getElementById('nav-explore');
const navAdd = document.getElementById('nav-add');

const searchInput = document.getElementById('movie-search');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');

const librarySearch = document.getElementById('library-search');
const genreContainer = document.getElementById('genre-container');
const sortSelect = document.getElementById('sort-select');
const movieList = document.getElementById('movie-list');

const modal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');

// --- STATE VARIABLES ---
let libraryData = []; 
let activeGenre = "All";

// --- 1. NAVIGATION LOGIC ---
navExplore.addEventListener('click', () => {
    exploreView.classList.remove('view-hidden');
    addView.classList.add('view-hidden');
    navExplore.classList.add('active');
    navAdd.classList.remove('active');
    loadLibrary(); // Refresh library when switching back
});

navAdd.addEventListener('click', () => {
    addView.classList.remove('view-hidden');
    exploreView.classList.add('view-hidden');
    navAdd.classList.add('active');
    navExplore.classList.remove('active');
});

// --- 2. TMDB SEARCH & SAVE ---
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    resultsContainer.innerHTML = ''; 

    data.results.forEach(movie => {
        // Map genre IDs to Text
        const mappedGenres = movie.genre_ids ? movie.genre_ids.map(id => tmdbGenres[id]).filter(g => g) : [];

        const div = document.createElement('div');
        div.style.marginBottom = "15px";
        div.innerHTML = `<h3>${movie.title} (${movie.release_date ? movie.release_date.substring(0,4) : 'N/A'})</h3> 
                         <p style="font-size:0.8rem; color:#8c8d90;">${mappedGenres.join(', ')}</p>
                         <button id="add-${movie.id}">Add to Library</button><hr>`;
        resultsContainer.appendChild(div);
        
        document.getElementById(`add-${movie.id}`).addEventListener('click', async () => {
            await setDoc(doc(db, "movies", movie.id.toString()), {
                title: movie.title,
                release_year: movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null,
                poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                genres: mappedGenres, // Saving the text array!
                metadata: JSON.stringify(movie)
            });
            alert(`${movie.title} added! Switch to 'Explore' to view it.`);
        });
    });
});

// --- 3. LOAD LIBRARY ---
async function loadLibrary() {
    libraryData = [];
    const availableGenres = new Set(["All"]); // To build dynamic pills
    
    const reviewSnap = await getDocs(collection(db, "reviews"));
    const allReviews = {};
    reviewSnap.forEach(doc => {
        const r = doc.data();
        if(!allReviews[r.movie_id]) allReviews[r.movie_id] = [];
        allReviews[r.movie_id].push(r);
    });

    const movieSnap = await getDocs(collection(db, "movies"));
    movieSnap.forEach(doc => {
        const movie = doc.data();
        movie.id = doc.id;
        movie.reviews = allReviews[movie.id] || [];
        
        let sum = 0;
        movie.reviews.forEach(r => sum += r.rating);
        movie.avgRating = movie.reviews.length > 0 ? (sum / movie.reviews.length).toFixed(1) : 0;
        
        // Ensure legacy movies don't crash the genre filter
        if(!movie.genres) movie.genres = [];
        movie.genres.forEach(g => availableGenres.add(g));

        libraryData.push(movie);
    });

    buildGenrePills(Array.from(availableGenres));
    renderList(); 
}

// --- 4. BUILD PILLS & RENDER LIST ---
function buildGenrePills(genres) {
    genreContainer.innerHTML = '';
    genres.forEach(genre => {
        const pill = document.createElement('div');
        pill.className = `genre-pill ${genre === activeGenre ? 'active' : ''}`;
        pill.innerText = genre;
        pill.addEventListener('click', () => {
            activeGenre = genre;
            // Update active styling
            document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderList();
        });
        genreContainer.appendChild(pill);
    });
}

function renderList() {
    movieList.innerHTML = '';
    const sortBy = sortSelect.value;
    const searchText = librarySearch.value.toLowerCase();

    // 1. FILTER by Search Text and Active Genre
    let filteredData = libraryData.filter(movie => {
        const matchesSearch = movie.title.toLowerCase().includes(searchText);
        const matchesGenre = activeGenre === "All" || (movie.genres && movie.genres.includes(activeGenre));
        return matchesSearch && matchesGenre;
    });

    // 2. SORT
    filteredData.sort((a, b) => {
        if (sortBy === 'name_asc') return a.title.localeCompare(b.title);
        if (sortBy === 'name_desc') return b.title.localeCompare(a.title);
        if (sortBy === 'rating_desc') return b.avgRating - a.avgRating;
        if (sortBy === 'year_desc') return b.release_year - a.release_year;
    });

    // 3. DRAW
    filteredData.forEach(movie => {
        const row = document.createElement('div');
        row.className = 'movie-row';
        row.innerHTML = `
            <div>
                <span class="row-title">${movie.title}</span> 
                <span class="row-year">(${movie.release_year})</span>
                <span class="row-genres">${movie.genres ? movie.genres.join(', ') : ''}</span>
            </div>
            <div class="row-rating">⭐ ${movie.avgRating > 0 ? movie.avgRating : 'New'}</div>
        `;
        row.addEventListener('click', () => openModal(movie));
        movieList.appendChild(row);
    });
}

// Real-time search listeners
librarySearch.addEventListener('input', renderList);
sortSelect.addEventListener('change', renderList);

// --- 5. DETAILED MODAL ---
function openModal(movie) {
    let reviewHTML = movie.reviews.length === 0 ? '<p>No reviews yet.</p>' : '';
    movie.reviews.forEach(r => {
        // Only show text if they actually wrote something
        const textDisplay = r.review_text ? `: ${r.review_text}` : '';
        reviewHTML += `<p><strong>${r.reviewer_name} (${'🍿'.repeat(r.rating)})</strong>${textDisplay}</p>`;
    });

    modalBody.innerHTML = `
        <div class="modal-layout">
            <img src="${movie.poster_url}" class="modal-poster">
            <div>
                <h2>${movie.title} (${movie.release_year})</h2>
                <p style="color:var(--text-muted); margin-top:-10px;">${movie.genres ? movie.genres.join(', ') : ''}</p>
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
            <input type="text" id="modal-text" placeholder="Write a review (Optional)...">
            <button id="modal-submit">Submit</button>
        </div>
    `;

    modal.classList.remove('hidden');

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

    document.getElementById('modal-submit').addEventListener('click', async () => {
        const ratingVal = Number(ratingInput.value);
        const textVal = document.getElementById('modal-text').value;
        
        // VALIDATION: Popcorn is required, text is optional
        if (ratingVal === 0) {
            alert("A popcorn rating is compulsory!");
            return;
        }

        await addDoc(collection(db, "reviews"), {
            movie_id: movie.id, 
            reviewer_name: "Me", 
            rating: ratingVal, 
            review_text: textVal || "", // Saves empty string if no text
            timestamp: new Date()
        });
        
        modal.classList.add('hidden'); 
        loadLibrary(); 
    });
}

closeModal.addEventListener('click', () => modal.classList.add('hidden'));

// Start app
loadLibrary();