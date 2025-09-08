const { spawn } = require('child_process');

console.log('Starting Next.js development server...');

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Keep the process running
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.kill();
  process.exit();
});
