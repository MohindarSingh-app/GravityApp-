import { DatePickerField } from './DatePickerField';
import { TextField } from './TextField';

export function DateTimeFields({
  dateLabel,
  timeLabel,
  date,
  time,
  onChangeDate,
  onChangeTime,
  error,
}) {
  return (
    <>
      <DatePickerField
        label={dateLabel}
        value={date}
        onChange={onChangeDate}
      />
      <TextField
        label={timeLabel}
        value={time}
        onChangeText={onChangeTime}
        placeholder="HH:MM"
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
      />
    </>
  );
}
