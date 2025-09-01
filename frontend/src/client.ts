import axios from 'axios';

export async function sendMessageToBackend(message: string) {
  // Example: POST to Python backend running on localhost:8000/chat
  // You may need to adjust the URL and payload to match your server.py API
  try {
    const response = await axios.post('http://localhost:8000/chat', { message });
    return response.data;
  } catch (error) {
    return { response: 'Error connecting to backend.' };
  }
}
