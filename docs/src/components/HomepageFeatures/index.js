import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

const FeatureList = [
  {
    title: "Tell LLMs when to step in",
    Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
    description: (
      <>
        Seamlessly put your repetitive software development tasks on autopilot
        by leveraging recipes created by others
      </>
    ),
  },
  {
    title: "Write your own recipes",
    Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
    description: (
      <>
        Use the Continue SDK to create your own custom steps and compose them
        into personalized recipes, guiding LLMs through common sequences of
        tasks
      </>
    ),
  },
  {
    title: "Wield LLMs with confidence",
    Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        Use the Continue GUI to review, reverse, and rerun steps or even entire
        recipes, allowing you to build trust in LLMs
      </>
    ),
  },
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
