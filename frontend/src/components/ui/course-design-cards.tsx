import React from "react";
import { Plus } from "lucide-react";

// Adapted for Leash from the "course design cards" component:
// - class names are prefixed `cdc-` (the original `card` collided with the app's `card` utility)
// - the original CSS was not supplied; the styles live in index.css under `.cdc-*`
// - the broken inline ellipsis SVG and the add SVG are replaced with lucide icons
// - progress width comes from `progressPercent` (the original never applied it)
// - the decorative menu dots are gone, and the add button only renders when given an addHref

export type CardColor = "green" | "orange" | "red" | "blue";

export interface CardData {
  id: number | string;
  colorClass: CardColor;
  date: string;
  title: string;
  description: string;
  progressPercent: string;
  progressValue: string;
  progressLabel?: string;
  imgSrc1?: string;
  imgAlt1?: string;
  imgSrc2?: string;
  imgAlt2?: string;
  countdownText: string;
  addHref?: string;
  addLabel?: string;
  href?: string;
}

interface CardProps {
  data: CardData;
}

const Card: React.FC<CardProps> = ({ data }) => {
  const {
    colorClass, date, title, description, progressPercent, progressValue, progressLabel = "Progress",
    imgSrc1, imgAlt1, imgSrc2, imgAlt2, countdownText, addHref, addLabel = "Add", href,
  } = data;

  return (
    <div className={`cdc-card cdc-${colorClass}`} style={{ "--cdc-progress": progressPercent } as React.CSSProperties}>
      <div className="cdc-header">
        <div className="cdc-date">{date}</div>
      </div>
      <div className="cdc-body">
        <h3>{href ? <a href={href}>{title}</a> : title}</h3>
        <p>{description}</p>
        <div className="cdc-progress">
          <span>{progressLabel}</span>
          <div className="cdc-progress-bar" role="progressbar" aria-valuenow={parseFloat(progressPercent)} aria-valuemin={0} aria-valuemax={100} />
          <span className="num">{progressValue}</span>
        </div>
      </div>
      <div className="cdc-footer">
        {(imgSrc1 || imgSrc2 || addHref) && (
          <ul>
            {imgSrc1 && <li><img src={imgSrc1} alt={imgAlt1 || "user avatar"} /></li>}
            {imgSrc2 && <li><img src={imgSrc2} alt={imgAlt2 || "user avatar"} /></li>}
            {addHref && (
              <li>
                <a href={addHref} className="cdc-btn-add" aria-label={addLabel}><Plus className="size-4" /></a>
              </li>
            )}
          </ul>
        )}
        <span className="cdc-btn-countdown">{countdownText}</span>
      </div>
    </div>
  );
};

export default Card;
