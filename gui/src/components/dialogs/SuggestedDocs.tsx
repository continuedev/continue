import { PackageDocsResult } from "core";

interface SuggestedDocProps {
  docResult: PackageDocsResult;
}
const SuggestedDoc = ({ docResult }: SuggestedDocProps) => {
  return <div>SuggestedDoc</div>;
};

interface SuggestedDocsListProps {
  docs: PackageDocsResult[];
  //   on
}
const SuggestedDocsList = ({ docs }: SuggestedDocsListProps) => {
  return <div></div>;
};

export default SuggestedDocsList;
