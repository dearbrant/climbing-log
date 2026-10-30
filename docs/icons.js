const files = {
  close: 'ic_cancel.svg',
  add: 'ic_add.svg',
  setting: 'ic_setting.svg',
  date: 'ic_date.svg',
  place: 'ic_location.svg',
  method: 'ic_style.svg',
  color: 'ic_color.svg',
  grade: 'ic_grade.svg',
  feel: 'ic_feeling.svg?v=20261030-feeling-dialog',
  outcome: 'ic_sent.svg',
  project: 'ic_project.svg',
};

export const icon = name => files[name] ? `<img src="./icons/${files[name]}" alt="" aria-hidden="true">` : '';
