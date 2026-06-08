import axios from 'axios';

const instance = axios.create({ baseURL: 'https://example.com/api' });

export const fetchEvents = (params) => instance.get('/events', { params });
export const fetchMapData = (layer) => instance.get(`/map-data/${layer}`);
export const updateUserSettings = (settings) => instance.post('/user/settings', settings);