import officeparser from 'officeparser';

export class DocxAndPdfParsing{
    public static async parseContent(filePath: string ): Promise<string> {
        const content = await officeparser.parseOfficeAsync(filePath);
        return content;
    }
}