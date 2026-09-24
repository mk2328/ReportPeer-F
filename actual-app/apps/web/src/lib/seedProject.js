// lib/seedProject.js
export const initialChapters = [
  { id: "abstract", title: "Abstract" },
  { id: "acknowledgement", title: "Acknowledgement" },
  { id: "ch1", title: "Chapter 1 - Introduction" },
  { id: "ch2", title: "Chapter 2 - Requirements" },
  { id: "ch3", title: "Chapter 3 - Analysis and Design" },
  { id: "ch4", title: "Chapter 4 - Project Plan" },
  { id: "ch5", title: "Chapter 5 - Test Plan" },
  { id: "ch6", title: "Chapter 6 - Implementation Details" },
  { id: "ch7", title: "Chapter 7 - Conclusion and Future Work" },
  { id: "refs", title: "References" },
  { id: "app-a", title: "Appendix A - Screenshots" },
  { id: "app-b", title: "Appendix B - Abbreviation" },
];

// Usage inside your Project Creation API
const newProject = await Project.create({
  userId: user.id,
  title: "New FYP Project",
  chapters: initialChapters.map(ch => ({ ...ch, content: "" }))
});