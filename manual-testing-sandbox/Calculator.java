public class Calculator {
    private double result;

    public Calculator add(double number) {
        result += number;
        return this;
    }

    public Calculator subtract(double number) {
        result -= number;
        return this;
    }


    public double getResult() {
        return result;
    }

    public Calculator reset() {
        result = 0;
        return this;
    }

    public static void main(String[] args) {
        Calculator calc = new Calculator();
        calc.add(10).subtract(5);
        System.out.println("Result: " + calc.getResult());
    }
}
