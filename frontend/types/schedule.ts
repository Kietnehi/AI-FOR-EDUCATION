export type ScheduleEvent = {
  id?: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  notified?: boolean;
<<<<<<< HEAD
=======
  completed?: boolean;
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
};

export type Schedule = {
  id: string;
  user_id: string;
  events: ScheduleEvent[];
  created_at: string;
  updated_at: string;
};

export type ScheduleUploadResponse = {
  extracted_text: string;
  events: ScheduleEvent[];
  is_valid_schedule: boolean;
  message?: string;
};
