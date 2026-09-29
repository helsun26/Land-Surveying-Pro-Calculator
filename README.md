# Land Surveying Pro Calculator

A more advanced survey-oriented calculator designed to cover coordinate, offset, stationing, height, and traverse calculations with validation and clear reporting.

## Features

- Coordinate from bearing and distance
- Bearing and distance between two points
- Left/right offset generation at regular station intervals
- Height / RL / grade calculation
- Traverse closure and precision checks
- Input validation for invalid distances, angles, and zero intervals
- Modern web interface for simple field use

## Run locally

1. Open `index.html` in a browser, or
2. Serve the folder with any local web server, for example:

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Project structure

- `index.html` – app layout
- `style.css` – application styling
- `script.js` – mathematical logic and validation

## Calculation examples

### Coordinate from start point

- Start X = 0
- Start Y = 0
- Bearing = 45°
- Distance = 100

Result:
- X ≈ 70.7107
- Y ≈ 70.7107

### Distance between two points

- Point A = (0, 0)
- Point B = (100, 0)

Result:
- Bearing = 0°
- Distance = 100

### Height from slope

- Horizontal distance = 50
- Starting RL = 100
- Slope angle = 5°

Result:
- Rise ≈ 4.369
- Final RL ≈ 104.369

### Traverse closure

Input legs:

```text
45, 50
90, 40
135, 30
```

The app calculates the final delta X, delta Y, closure error, and relative precision.

## Notes

This version is intentionally structured as a practical survey calculator rather than a single formula-only utility. It focuses on usability, validation, and professional field-style workflows.



















