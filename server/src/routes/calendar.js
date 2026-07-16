import { Hono } from 'hono';

import {
    acknowledgeCalendarSchedule,
    createCalendarItem,
    deleteCalendarItem,
    getCalendar,
    getCalendarMapNote,
    updateCalendarItem,
} from '../controllers/calendarController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authenticateToken);
router.get('/', getCalendar);
router.get('/map-notes/:noteId', getCalendarMapNote);
router.post('/items', createCalendarItem);
router.patch('/items/:itemId', updateCalendarItem);
router.delete('/items/:itemId', deleteCalendarItem);
router.post('/schedule-states/acknowledge', acknowledgeCalendarSchedule);

export default router;
