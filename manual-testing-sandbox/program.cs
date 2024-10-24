using System;

public class Program
{
    public static void Main(string[] args)
    {
        Console.WriteLine("Hello World!");
        Calculator calc = new Calculator();
        calc.Add(5).Subtract(3);
        Console.WriteLine("Result: " + calc.GetResult());
    }

    public class Calculator
    {
        private double result;

        public Calculator Add(double number)
        {
            result += number;
            return this;
        }

        public Calculator Subtract(double number)
        {
            result -= number;
            return this;
        }

        public double GetResult()
        {
            return result;
        }
    }
}