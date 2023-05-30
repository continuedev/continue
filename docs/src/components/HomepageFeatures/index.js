import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Define the scenarios where LLMs should step into accelerate you',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Enable LLMs to be an autopilot for parts of your software development tasks by 
        leveraging steps and recipes created by others in your workflows as you code
      </>
    ),
  },
  {
    title: 'Create your own workflows to show LLMs exactly what to do',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Use the Continue SDK to create your own custom steps and compose them together
        into personalized recipes, so that using LLMs actually fits into your workflows
      </>
    ),
  },
  {
    title: 'Guide the work done by LLMs to learn when to use and trust them',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Use the Continue GUI to review, reverse, and rerun some steps or even entire recipes,
        incorporating LLMs with confidence into the workflows you use to create software
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
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
