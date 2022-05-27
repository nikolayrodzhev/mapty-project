'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnDeleteAll = document.querySelector('.btn-delete--all');
const btnShowAll = document.querySelector('.btn-show--all');
const btnClose = document.querySelector('.close-btn');
const errOverlay = document.querySelector('.msg-overlay');
const msg = document.querySelector('.msg');
const btnConf = document.querySelectorAll('.confirmation-btn');
const btnYes = document.querySelector('.yes--btn');
const btnCancel = document.querySelector('.cancel--btn');

class App {
  #map;
  #mapZoomLevel = 16;

  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    btnDeleteAll.addEventListener('click', this._deleteAllWorkouts.bind(this));
    btnShowAll.addEventListener('click', this._showAllWorkouts.bind(this));
    btnClose.addEventListener('click', this._closeError.bind(this));
    btnCancel.addEventListener('click', this._closeError.bind(this));
  }

  _renderErrMsg(errMsg) {
    errOverlay.classList.remove('hidden');
    msg.textContent = errMsg;
    btnConf.forEach(btn => btn.classList.add('hidden'));
  }

  _renderConfMsg(confMsg) {
    errOverlay.classList.remove('hidden');
    msg.textContent = confMsg;
    btnConf.forEach(btn => btn.classList.remove('hidden'));
  }

  _closeError() {
    errOverlay.classList.add('hidden');
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
        this._renderErrMsg('We could not get your location :(')
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling map clicks
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    e.preventDefault();
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._renderErrMsg('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._renderErrMsg('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  // Find and remove workout
  _findRemoveWorkout(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workoutObject = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    // Remove the workout  element
    workoutEl.remove();

    // Remove the workout object from the #workouts array
    const index = this.#workouts.indexOf(workoutObject);
    this.#workouts.splice(index, 1);

    // Remove the marker
    this.#markers[index].remove();
    this.#markers.splice(index, 1);
    return workoutObject;
  }

  // Edit workout
  _editWorkout(e) {
    if (!this.#map) return;

    const btnEdit = e.target.closest('.workout__edit-btn');

    if (!btnEdit) return;

    // Find the workout that is going to be edited
    const workout = this._findRemoveWorkout(e);

    // Managing the form data
    form.style.transition = 'none';
    // Managing the elevation field based on the type of workout
    if (inputType.value !== workout.type) this._toggleElevationField();

    // Getting the data of the workout which is going to be edited
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    inputCadence.value = workout.cadence;
    inputElevation.value = workout.elevationGain;

    // Showing the form with the correct data
    this._showForm({
      latlng: { lat: workout.coords[0], lng: workout.coords[1] },
    });

    // Managing the elevation field DATA based on the type of workout
    if (!workout.cadence) inputCadence.value = 0;
    if (!workout.elevationGain) inputElevation.value = 0;
  }

  // Delete workout
  async _deleteWorkout(e) {
    if (!this.#map) return;

    const btnDelete = e.target.closest('.workout__delete-btn');

    if (!btnDelete) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    // Asking the user for confirmation
    this._renderConfMsg('Are you sure that you want to delete this workout?');

    // Wait for the user to decide
    await this._btnYesClicked(btnYes, e, this._findRemoveWorkout.bind(this));

    // Close confirmation box
    this._closeError();

    // Set local storage
    this._setLocalStorage();
  }

  async _btnYesClicked(btn, e, func) {
    return new Promise(resolve => (btn.onclick = () => resolve(func(e))));
  }

  _removeAllWorkouts() {
    // Delete workouts in the list
    const workoutEls = document.querySelectorAll('.workout');
    workoutEls.forEach(workout => workout.remove());

    // Empty the workouts array
    this.#workouts = [];

    // Delete markers on the map
    this.#markers.forEach(marker => marker.remove());

    // Empty the markers array
    this.#markers = [];
  }

  async _deleteAllWorkouts() {
    // Ask the user for confirmation
    this._renderConfMsg('Are you sure that you want to delete all workouts?');

    // Wait for the user to decide
    await this._btnYesClicked(btnYes, '', this._removeAllWorkouts.bind(this));

    // Close confirmation box
    this._closeError();

    // Set local storage
    this._setLocalStorage();
  }

  // Display marker
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);
    this.#markers.push(marker);
    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__edit">
            <button class="workout__edit-btn">EDIT</button>
            <button class="workout__delete-btn"><ion-icon class="icon" name="trash-outline"></ion-icon></button>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using public interface
    // workout.click();
  }

  _showAllWorkouts() {
    const coordinatesWorkouts = [];
    this.#workouts.forEach(workObj => coordinatesWorkouts.push(workObj.coords));
    this.#map.fitBounds(coordinatesWorkouts);
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }
}

const app = new App();
