import documentationModel from "../../models/documentation.model";

export class DocumentationDao {
    static async create(data: any) {
        return await documentationModel.create(data);
    }

    static async getAll() {
        return await documentationModel.find().sort({ createdAt: -1 });
    }

    static async getById(id: string) {
        return await documentationModel.findById(id);
    }

    static async getByCategory(category: string) {
        return await documentationModel.find({ category }).sort({ createdAt: -1 });
    }

    static async search(searchText: string) {
        return await documentationModel.find({
            $text: { $search: searchText }
        }).sort({ createdAt: -1 });
    }

    static async update(id: string, data: any) {
        return await documentationModel.findByIdAndUpdate(id, data, { new: true });
    }

    static async delete(id: string) {
        return await documentationModel.findByIdAndDelete(id);
    }

    static async getAllCategories() {
        return await documentationModel.distinct("category");
    }
}
