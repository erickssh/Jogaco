import { useId } from "react";
import { carModels, imageForModel } from "../../public/volta-rapida/car-models";
import styles from "./racer.module.css";

export function CarPicker({title, value, onChange}: {
  title: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const group = useId();
  return <fieldset className={styles.carPicker}>
    <legend>{title}</legend>
    <div className={styles.carChoices}>
      {carModels.map(car => <label key={car.id}>
        <input type="radio" name={group} value={car.id} required checked={value === car.id}
          onChange={() => onChange(car.id)}/>
        <span className={styles.carCard}>
          <span className={styles.carStage}><img src={imageForModel(car.id)} alt="" decoding="async"/></span>
          <span>{car.name}</span>
        </span>
      </label>)}
    </div>
  </fieldset>;
}
