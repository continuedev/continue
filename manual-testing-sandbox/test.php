<?php

class Calculator {
    private $result = 0.0;

    public function add($number) {
        $this->result += $number;
        return $this;
    }

    public function subtract($number) {
        $this->result -= $number;
        return $this;
    }

    public function multiply($number) {
        $this->result *= $number;
        return $this;
    }

    public function divide($number) {
        if ($number != 0) {
            $this->result /= $number;
        } else {
            echo "Division by zero error.";
        }
        return $this;
    }

    public function getResult() {
        return $this->result;
    }

    public function reset() {
        $this->result = 0.0;
        return $this;
    }
}

$calc = new Calculator();
$calc->add(10)->subtract(5);
echo "Result: " . $calc->getResult() . "\n";

?>
