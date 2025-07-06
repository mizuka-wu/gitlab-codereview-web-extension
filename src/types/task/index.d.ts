export type AnalysisTask = {
  mergeRequestUrl: string;
  uuid: string;
  status: "pending" | "processing" | "completed" | "failed";
};
