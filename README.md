# Jibo Aurora ROM Test

Minimal Aurora skill compatibility test for Jibo robots running Phoenix or a compatible 5x1 setup.

## Background

On November 16, 2026, Aurora was successfully executed on a White Jibo running Phoenix firmware using the Re-Commander ROM interface.

The robot displayed an image and spoke the Aurora forecast.

Compatibility with 5x1 configurations has not yet been verified.

## Requirements

- Node.js 20 or newer
- A compatible Jibo ROM interface
- Your Jibo's local IP address
- Access to ROM port 8160 (or the port used by your setup)

## Installation

1. Clone this repository.
2. Open the project directory.
3. Run npm install.
4. Run npm start.
5. Enter your Jibo's IP address when prompted.

## Start Aurora

Open another terminal and execute:

    curl http://127.0.0.1:3000/aurora/start

## Notes

- ROM communication uses rom-control 2.0.2.
- The default ROM port is 8160.
- Wake-word detection is not included.
- This is not the complete Re-Commander or RoboHub.
- Compatibility with 5x1 remains experimental.

## License

No license is granted for the original code in this repository.
